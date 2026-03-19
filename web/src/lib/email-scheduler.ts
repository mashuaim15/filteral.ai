/**
 * Email Scheduler Service
 * Runs as a cron job to send daily recommendation emails at users' preferred times.
 * IMPORTANT: Always generates fresh recommendations before sending emails.
 */

import cron from "node-cron";
import { prisma } from "./db";
import { sendDailyRecommendations } from "./email";
import { generateRecommendationsForUser } from "./generate-recommendations";

let schedulerStarted = false;

export function startEmailScheduler() {
  if (schedulerStarted) {
    console.log("[EmailScheduler] Already running");
    return;
  }

  // Run every 10 minutes to check for scheduled emails
  cron.schedule("*/10 * * * *", async () => {
    console.log("[EmailScheduler] Running check...");
    await sendScheduledEmails();
  });

  schedulerStarted = true;
  console.log("[EmailScheduler] Started - checking every 10 minutes");
}

export async function sendScheduledEmails() {
  try {
    const now = new Date();

    // Get all users with email enabled
    const users = await prisma.user.findMany({
      where: {
        preferences: {
          emailEnabled: true,
        },
      },
      include: {
        preferences: true,
      },
    });

    console.log(`[EmailScheduler] Found ${users.length} users with email enabled`);

    let sentCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      if (!user.email) {
        console.log(`[EmailScheduler] Skipped user ${user.id}: no email`);
        skippedCount++;
        continue;
      }

      const prefs = user.preferences;
      if (!prefs) {
        console.log(`[EmailScheduler] Skipped ${user.email}: no preferences`);
        skippedCount++;
        continue;
      }

      // Simple gap check: must be at least 18 hours since last email (prevents double-sends, never skips a day)
      const MIN_GAP_MS = 18 * 60 * 60 * 1000;
      const lastSent = prefs.lastEmailSentAt ? new Date(prefs.lastEmailSentAt).getTime() : 0;

      if (now.getTime() - lastSent < MIN_GAP_MS) {
        console.log(`[EmailScheduler] Skipped ${user.email}: sent ${Math.round((now.getTime() - lastSent) / 3600000)}h ago`);
        skippedCount++;
        continue;
      }

      // Check if current time has reached preferred time (in user's timezone)
      const userTimezone = prefs.emailTimezone || "UTC";
      const [prefHour, prefMinute] = prefs.emailTime.split(":").map(Number);
      const nowInUserTZ = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
      const currentMinutes = nowInUserTZ.getHours() * 60 + nowInUserTZ.getMinutes();
      const preferredMinutes = prefHour * 60 + prefMinute;

      if (currentMinutes < preferredMinutes) {
        console.log(`[EmailScheduler] Skipped ${user.email}: waiting for ${prefs.emailTime} ${userTimezone} (now ${nowInUserTZ.getHours()}:${String(nowInUserTZ.getMinutes()).padStart(2, '0')})`);
        skippedCount++;
        continue;
      }

      // SEND: not sent recently AND current time >= preferred time
      console.log(`[EmailScheduler] ${user.email}: sending now`);

      // Generate fresh recommendations before sending
      console.log(`[EmailScheduler] Generating fresh recommendations for ${user.email}...`);
      const genResult = await generateRecommendationsForUser(user.id, true);

      if (!genResult.success || genResult.count === 0) {
        console.log(`[EmailScheduler] Skipped ${user.email}: generation failed or no recommendations (${genResult.error || 'no recs'})`);
        skippedCount++;
        continue;
      }

      // Fetch all recommendations from DB, sorted by importance score
      const freshRecommendations = await prisma.recommendation.findMany({
        where: { userId: user.id },
        orderBy: { importanceScore: "desc" },
      });

      if (freshRecommendations.length === 0) {
        console.log(`[EmailScheduler] Skipped ${user.email}: no recommendations after generation`);
        skippedCount++;
        continue;
      }

      // Send email
      try {
        const success = await sendDailyRecommendations(user.email, {
          userName: user.name || "there",
          recommendations: freshRecommendations.map((rec) => ({
            site: rec.site,
            title: rec.title,
            author: rec.author,
            url: rec.url,
            reason: rec.reason,
            thumbnail: rec.coverUrl || undefined,
            importanceScore: rec.importanceScore,
          })),
          date: now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        });

        if (success) {
          await prisma.userPreferences.update({
            where: { userId: user.id },
            data: {
              lastEmailSentAt: now,
            },
          });
          sentCount++;
          console.log(`[EmailScheduler] Sent email to ${user.email}`);
        }
      } catch (error) {
        console.error(`[EmailScheduler] Failed to send to ${user.email}:`, error);
      }
    }

    console.log(`[EmailScheduler] Done: ${sentCount} sent, ${skippedCount} skipped`);
    return { sentCount, skippedCount };
  } catch (error) {
    console.error("[EmailScheduler] Error:", error);
    throw error;
  }
}
