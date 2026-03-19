import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptApiKey } from "@/lib/crypto";
import { workerClient } from "@/lib/worker-client";
import { getMaxRecommendations } from "@/lib/subscription";
import { Site, Tier } from "@prisma/client";

const DAILY_GENERATION_LIMITS: Record<Tier, number> = {
  FREE: 20,
  PRO: 20,
  MAX: 20,
};

export async function POST() {
  // ── Pre-flight ──────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      connections: { where: { connected: true } },
      preferences: true,
      persona: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let prefs = user.preferences;
  if (!prefs) {
    prefs = await prisma.userPreferences.create({ data: { userId: user.id } });
  }

  // Daily limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDailyGenerations = DAILY_GENERATION_LIMITS[user.subscriptionTier];
  const lastGenDate = prefs.lastGeneratedDate ? new Date(prefs.lastGeneratedDate) : null;
  const isNewDay = !lastGenDate || lastGenDate < today;
  const currentCount = isNewDay ? 0 : prefs.todayGenerationCount;

  if (currentCount >= maxDailyGenerations) {
    return NextResponse.json(
      {
        error: `Daily limit reached. ${user.subscriptionTier} tier allows ${maxDailyGenerations} generations per day.`,
        remainingAttempts: 0,
      },
      { status: 429 }
    );
  }

  // Self-hosted API key gate
  if (process.env.DEPLOYMENT_MODE === "self-hosted" && !(prefs as any).aiApiKey) {
    return NextResponse.json(
      { error: "API key required. Please configure your AI API key in Profile settings." },
      { status: 400 }
    );
  }

  // ── Build agent request ─────────────────────────────────────────────────
  const maxCount = getMaxRecommendations(user.subscriptionTier);
  const userCount = prefs.recommendationCount || 10;
  const targetCount = Math.min(userCount, maxCount);
  const keywords = (prefs as any).keywords || "";

  // Build persona string (compiledPersona + viewing signals)
  let personaForAI = user.persona?.compiledPersona || "";
  if (user.persona?.viewingSignals) {
    try {
      const signals = JSON.parse(user.persona.viewingSignals);
      const signalParts: string[] = [];
      if (signals.bilibili?.analysis) signalParts.push(`Bilibili: ${signals.bilibili.analysis}`);
      if (signals.youtube?.analysis) signalParts.push(`YouTube: ${signals.youtube.analysis}`);
      if (signalParts.length > 0) {
        personaForAI = personaForAI
          ? `${personaForAI}\n\nViewing patterns: ${signalParts.join("; ")}`
          : `Viewing patterns: ${signalParts.join("; ")}`;
      }
    } catch { /* ignore */ }
  }

  // Build available connections map
  const bilibiliConnection = user.connections.find((c) => c.site === "BILIBILI");
  const youtubeConnection = user.connections.find((c) => c.site === "YOUTUBE");
  const availableConnections: Record<string, string | null> = {
    bilibili: bilibiliConnection?.authState || null,
    youtube: youtubeConnection?.authState || null,
  };

  const agentRequest = {
    persona: personaForAI,
    target_count: targetCount,
    available_connections: availableConnections,
    keywords,
    viewing_signals: user.persona?.viewingSignals || "",
    cached_history: (bilibiliConnection as any)?.cachedHistory || undefined,
    cached_channels: (bilibiliConnection as any)?.cachedChannels || undefined,
    // MAX tier: use system Anthropic key + claude-sonnet-4-6.
    // PRO with own key: honour their model choice.
    // Fallback: server's OpenAI key + gpt-4o-mini.
    ...((() => {
      if (user.subscriptionTier === "MAX") {
        return {
          ai_model: "claude-sonnet-4-6",
          ai_api_key: process.env.ANTHROPIC_API_KEY,
        };
      }
      const userKey = (prefs as any).aiApiKey ? decryptApiKey((prefs as any).aiApiKey) : null;
      return {
        ai_model: userKey ? ((prefs as any).aiModel || "gpt-4o-mini") : "gpt-4o-mini",
        ai_api_key: userKey || process.env.OPENAI_API_KEY,
      };
    })()),
    followed_accounts: (prefs as any).followedAccounts || {
      x: [], youtube: [], bilibili: [], wildSearch: [],
    },
  };

  // ── Call worker streaming endpoint ─────────────────────────────────────
  let workerResponse: Response;
  try {
    workerResponse = await workerClient.streamAgentRecommendations(agentRequest);
  } catch (e) {
    console.error("[Generate] Failed to reach worker:", e);
    return NextResponse.json({ error: "Failed to connect to worker" }, { status: 500 });
  }

  if (!workerResponse.ok || !workerResponse.body) {
    return NextResponse.json({ error: "Worker returned an error" }, { status: 500 });
  }

  // ── Stream proxy ────────────────────────────────────────────────────────
  const userId = session.user.id!;
  const reader = workerResponse.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let buffer = "";

      const safeEnqueue = (chunk: string) => {
        if (!closed) controller.enqueue(new TextEncoder().encode(chunk));
      };
      const safeClose = () => {
        if (!closed) { closed = true; controller.close(); }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE messages are separated by \n\n
          const messages = buffer.split("\n\n");
          buffer = messages.pop() ?? "";

          for (const message of messages) {
            const line = message.trim();
            if (!line.startsWith("data: ")) continue;

            let event: any;
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              console.warn("[Generate] Failed to parse SSE line:", line);
              continue;
            }

            if (event.type === "done") {
              // ── DB operations ─────────────────────────────────────────
              try {
                const items: Array<{
                  item_id: string; title: string; author: string;
                  cover_url: string; url: string; reason: string;
                  source: string; platform: string;
                }> = event.items || [];

                // Map agent fields to Prisma schema fields
                const mapped = items.map((item) => ({
                  userId,
                  videoId: item.item_id,
                  title: item.title,
                  author: item.author,
                  coverUrl: item.cover_url,
                  url: item.url,
                  reason: item.reason,
                  source: item.source,
                  site: item.platform.toUpperCase() as Site,
                }));

                // Replace current recommendations with the new batch
                await prisma.recommendation.deleteMany({ where: { userId } });

                if (mapped.length > 0) {
                  await prisma.recommendation.createMany({ data: mapped });
                }

                const newCount = currentCount + 1;
                await prisma.userPreferences.update({
                  where: { userId },
                  data: { lastGeneratedDate: new Date(), todayGenerationCount: newCount },
                });

                // Handle needsReauth
                const needsReauth: Record<string, boolean> = event.needs_reauth || {};
                for (const [platform, needs] of Object.entries(needsReauth)) {
                  if (needs) {
                    const site = platform.toUpperCase() as Site;
                    const conn = user.connections.find((c) => c.site === site);
                    if (conn) {
                      await prisma.siteConnection.update({
                        where: { id: conn.id },
                        data: { needsReauth: true },
                      });
                    }
                  }
                }

                safeEnqueue(
                  `data: ${JSON.stringify({ type: "done", count: mapped.length })}\n\n`
                );
              } catch (dbError) {
                console.error("[Generate] DB write failed:", dbError);
                safeEnqueue(
                  `data: ${JSON.stringify({ type: "error", message: "Failed to save recommendations" })}\n\n`
                );
              }
              safeClose();
              return;
            } else {
              safeEnqueue(`data: ${JSON.stringify(event)}\n\n`);
            }
          }
        }
      } catch (e) {
        console.error("[Generate] Stream read error:", e);
        safeEnqueue(
          `data: ${JSON.stringify({ type: "error", message: "Stream interrupted" })}\n\n`
        );
      } finally {
        // Always close the stream so the client is never left hanging
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
