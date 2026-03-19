import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendDailyRecommendations } from "@/lib/email";

// This endpoint should be called by a cron job (e.g., Google Cloud Scheduler)
// Add a secret key check for security in production

export async function GET(request: Request) {
  // Auth check - CRON_SECRET env var must be set
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all users with email enabled
    const users = await prisma.user.findMany({
      where: {
        preferences: {
          emailEnabled: true,
        },
      },
      include: {
        preferences: true,
        recommendations: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const user of users) {
      if (!user.email || user.recommendations.length === 0) {
        continue;
      }

      // Check if it's the right time for this user (based on timezone)
      const prefs = user.preferences;
      if (prefs) {
        const userTime = new Date().toLocaleTimeString("en-US", {
          timeZone: prefs.emailTimezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        // Only send if within 30 minutes of preferred time
        const [prefHour, prefMin] = prefs.emailTime.split(":").map(Number);
        const [curHour, curMin] = userTime.split(":").map(Number);

        const prefMinutes = prefHour * 60 + prefMin;
        const curMinutes = curHour * 60 + curMin;
        const diff = Math.abs(prefMinutes - curMinutes);

        if (diff > 30 && diff < 1410) { // 1410 = 24*60 - 30 (handle midnight wrap)
          continue;
        }
      }

      try {
        const success = await sendDailyRecommendations(user.email, {
          userName: user.name || "there",
          recommendations: user.recommendations.map((rec) => ({
            site: rec.site,
            title: rec.title,
            author: rec.author,
            url: rec.url,
            reason: rec.reason,
            thumbnail: rec.coverUrl || undefined,
          })),
          date: new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        });

        results.push({ email: user.email, success });
      } catch (error) {
        results.push({
          email: user.email,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error("Cron daily error:", error);
    return NextResponse.json(
      { error: "Failed to process daily emails" },
      { status: 500 }
    );
  }
}
