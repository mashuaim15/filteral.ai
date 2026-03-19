/**
 * Shared recommendation generation logic.
 * Used by both the API route and the email scheduler.
 */

import { prisma } from "./db";
import { workerClient } from "./worker-client";
import { getMaxRecommendations } from "./subscription";
import { decryptApiKey } from "./crypto";
import { Site, Tier } from "@prisma/client";

const DAILY_GENERATION_LIMITS: Record<Tier, number> = {
  FREE: 20,
  PRO: 20,
  MAX: 20,
};

interface RecommendationItem {
  site: Site;
  videoId: string;
  title: string;
  author: string;
  coverUrl: string;
  reason: string;
  source: string;
  url: string;
  importanceScore: number;
}

interface GenerateResult {
  success: boolean;
  count: number;
  error?: string;
}

/**
 * Generate recommendations for a user.
 * @param userId - The user ID to generate for
 * @param skipLimitCheck - If true, skip daily generation limit (for scheduled emails)
 */
export async function generateRecommendationsForUser(
  userId: string,
  skipLimitCheck: boolean = false
): Promise<GenerateResult> {
  try {
    // Get user with preferences and persona
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        persona: true,
      },
    });

    if (!user) {
      return { success: false, count: 0, error: "User not found" };
    }

    // Check daily generation limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let prefs = user.preferences;
    if (!prefs) {
      prefs = await prisma.userPreferences.create({
        data: { userId: user.id },
      });
    }

    const maxDailyGenerations = DAILY_GENERATION_LIMITS[user.subscriptionTier];
    const lastGenDate = prefs.lastGeneratedDate
      ? new Date(prefs.lastGeneratedDate)
      : null;
    const isNewDay = !lastGenDate || lastGenDate < today;
    const currentCount = isNewDay ? 0 : prefs.todayGenerationCount;

    if (!skipLimitCheck && currentCount >= maxDailyGenerations) {
      return {
        success: false,
        count: 0,
        error: `Daily limit reached (${maxDailyGenerations} per day)`,
      };
    }

    // Get settings
    const mode = prefs.recommendationMode || "AI_MIXED";
    const maxCount = getMaxRecommendations(user.subscriptionTier);
    const userCount = prefs.recommendationCount || 10;
    const keywords = prefs.keywords || "";

    // Prepare persona for AI
    let personaForAI = user.persona?.compiledPersona || "";
    if (user.persona?.viewingSignals) {
      try {
        const signals = JSON.parse(user.persona.viewingSignals);
        const signalParts = [];
        if (signals.bilibili?.analysis) {
          signalParts.push(`Bilibili: ${signals.bilibili.analysis}`);
        }
        if (signals.youtube?.analysis) {
          signalParts.push(`YouTube: ${signals.youtube.analysis}`);
        }
        if (signalParts.length > 0) {
          personaForAI = personaForAI
            ? `${personaForAI}\n\nViewing patterns: ${signalParts.join("; ")}`
            : `Viewing patterns: ${signalParts.join("; ")}`;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Both modes use userCount as the target
    const targetCount = Math.min(userCount, maxCount);

    console.log(`[Generate:${userId}] Target: ${targetCount}, Mode: ${mode}`);

    // No platform connections - all null (keyword/persona based only)
    const availableConnections: Record<string, string | null> = {
      bilibili: null,
      youtube: null,
      reddit: null,
      x: null,
    };

    // Resolve AI config from user preferences
    let aiModel: string;
    let aiApiKey: string | undefined;
    if (user.subscriptionTier === "MAX") {
      aiModel = "claude-sonnet-4-6";
      aiApiKey = process.env.ANTHROPIC_API_KEY;
    } else {
      const userApiKey = prefs.aiApiKey ? decryptApiKey(prefs.aiApiKey) : null;
      aiModel = userApiKey ? (prefs.aiModel || "gpt-4o-mini") : "gpt-4o-mini";
      aiApiKey = userApiKey || process.env.OPENAI_API_KEY;
    }

    // Parse followed accounts
    const defaultFollowedAccounts = { x: [], youtube: [], bilibili: [], wildSearch: [] };
    let followedAccounts = defaultFollowedAccounts;
    if (prefs.followedAccounts) {
      try {
        followedAccounts = JSON.parse(prefs.followedAccounts);
      } catch {
        // Ignore parse errors
      }
    }

    // Run agentic recommendation loop
    console.log(`[Generate:${userId}] Running agent with model: ${aiModel}`);
    const fetchStart = Date.now();

    const agentResult = await workerClient.agentRecommendations({
      persona: personaForAI,
      target_count: targetCount,
      available_connections: availableConnections,
      keywords,
      viewing_signals: user.persona?.viewingSignals || "",
      ai_model: aiModel,
      ai_api_key: aiApiKey || undefined,
      followed_accounts: followedAccounts,
    });

    console.log(`[Generate:${userId}] Agent completed in ${Date.now() - fetchStart}ms, iterations: ${agentResult.iterations_used}, platforms: ${agentResult.platforms_queried.join(", ")}`);

    if (agentResult.recommendations.length === 0) {
      return {
        success: false,
        count: 0,
        error: "No recommendations found from any platform",
      };
    }

    // Map platform strings to Site enum
    const platformToSite: Record<string, Site> = {
      bilibili: "BILIBILI",
      youtube: "YOUTUBE",
      reddit: "REDDIT",
      x: "X",
    };

    const finalRecommendations: RecommendationItem[] = agentResult.recommendations.map((rec) => ({
      site: (platformToSite[rec.platform] || "YOUTUBE") as Site,
      videoId: rec.item_id,
      title: rec.title,
      author: rec.author,
      coverUrl: rec.cover_url || "",
      reason: rec.reason,
      source: rec.source || "",
      url: rec.url,
      importanceScore: rec.importance_score || 5,
    }));

    console.log(`[Generate:${userId}] Final count: ${finalRecommendations.length}/${targetCount}`);

    // Delete old and save new recommendations
    await prisma.recommendation.deleteMany({
      where: { userId },
    });

    await prisma.recommendation.createMany({
      data: finalRecommendations.map((rec) => ({
        userId,
        site: rec.site,
        videoId: rec.videoId,
        title: rec.title,
        author: rec.author,
        coverUrl: rec.coverUrl,
        reason: rec.reason,
        source: rec.source,
        url: rec.url,
        importanceScore: rec.importanceScore,
      })),
    });

    // Update generation count (only if not skipping limit check)
    if (!skipLimitCheck) {
      const newCount = currentCount + 1;
      await prisma.userPreferences.update({
        where: { userId },
        data: {
          lastGeneratedDate: new Date(),
          todayGenerationCount: newCount,
        },
      });
    }

    console.log(`[Generate:${userId}] Saved ${finalRecommendations.length} recommendations`);

    return {
      success: true,
      count: finalRecommendations.length,
    };
  } catch (error) {
    console.error(`[Generate:${userId}] Error:`, error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
