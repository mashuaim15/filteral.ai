import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, sendDailyRecommendations } from "@/lib/email";

// Test endpoint to verify email configuration
// Free users: 3 simple tests per day
// Pro users: 1 real recommendation email per day

const MAX_TEST_EMAILS_FREE = 999; // Temporarily disabled for development
const MAX_TEST_EMAILS_PRO = 999; // Temporarily disabled for development

export async function POST() {
  const session = await auth();

  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user with preferences and recommendations
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        preferences: true,
        recommendations: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isPro = user.subscriptionTier === "PRO" || user.subscriptionTier === "MAX";
    const maxTests = isPro ? MAX_TEST_EMAILS_PRO : MAX_TEST_EMAILS_FREE;

    // Check rate limit
    const prefs = user.preferences;
    const lastTestDate = prefs?.lastSettingsChangeDate
      ? new Date(prefs.lastSettingsChangeDate)
      : null;
    const isNewDay = !lastTestDate || lastTestDate < today;
    const testCount = isNewDay ? 0 : (prefs?.todaySettingsChangeCount || 0);

    if (testCount >= maxTests) {
      return NextResponse.json(
        {
          error: isPro
            ? "You've already sent your daily recommendation email. Try again tomorrow!"
            : `Test email limit reached (${maxTests}/day)`
        },
        { status: 429 }
      );
    }

    let success = false;

    if (isPro && user.recommendations.length > 0) {
      // Pro users get real recommendations
      success = await sendDailyRecommendations(session.user.email, {
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
    } else {
      // Free users or Pro without recommendations get simple test
      success = await sendEmail({
        to: session.user.email,
        subject: "Filteral - Test Email",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
            <h1 style="color: #111;">Email Test Successful!</h1>
            <p style="color: #666;">
              If you're seeing this email, your Filteral email configuration is working correctly.
            </p>
            ${!isPro ? `
              <p style="color: #888; font-size: 14px; margin-top: 20px;">
                <strong>Tip:</strong> Upgrade to Pro to receive your actual recommendations via email!
              </p>
            ` : user.recommendations.length === 0 ? `
              <p style="color: #888; font-size: 14px; margin-top: 20px;">
                Generate some recommendations first, then you can send them via email!
              </p>
            ` : ''}
            <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
              Sent at: ${new Date().toISOString()}
            </p>
          </div>
        `,
      });
    }

    if (success) {
      // Update test count
      await prisma.userPreferences.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          lastSettingsChangeDate: new Date(),
          todaySettingsChangeCount: 1,
        },
        update: {
          lastSettingsChangeDate: new Date(),
          todaySettingsChangeCount: isNewDay ? 1 : testCount + 1,
        },
      });

      const newCount = isNewDay ? 1 : testCount + 1;
      return NextResponse.json({
        success: true,
        message: isPro && user.recommendations.length > 0
          ? `Daily recommendations sent to ${session.user.email}`
          : `Test email sent to ${session.user.email}`,
        remainingTests: maxTests - newCount,
        type: isPro && user.recommendations.length > 0 ? "recommendations" : "test",
      });
    } else {
      return NextResponse.json(
        { error: "Failed to send email. Check server logs for details." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Test email error:", error);
    return NextResponse.json(
      {
        error: "Email sending failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
