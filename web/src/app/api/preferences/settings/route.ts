import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

const MAX_DAILY_SETTINGS_CHANGES = 999; // Temporarily disabled for development

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      recommendationMode,
      recommendationCount,
      includeGeneral,
      emailEnabled,
      emailTime,
      emailTimezone,
    } = body;

    // Get current preferences to check daily limit
    let prefs = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
    });

    // Check daily settings change limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastChangeDate = prefs?.lastSettingsChangeDate
      ? new Date(prefs.lastSettingsChangeDate)
      : null;
    const isNewDay = !lastChangeDate || lastChangeDate < today;
    const currentCount = isNewDay ? 0 : prefs?.todaySettingsChangeCount || 0;

    if (currentCount >= MAX_DAILY_SETTINGS_CHANGES) {
      return NextResponse.json(
        {
          error: "Daily limit reached. You can change settings up to 3 times per day.",
          remainingChanges: 0,
        },
        { status: 429 }
      );
    }

    // Update user name if provided
    if (name !== undefined) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { name },
      });
    }

    // Upsert preferences
    const newCount = currentCount + 1;
    prefs = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        recommendationMode: recommendationMode || "AI_MIXED",
        recommendationCount: recommendationCount || 10,
        includeGeneral: includeGeneral ?? true,
        emailEnabled: emailEnabled ?? true,
        emailTime: emailTime || "08:00",
        emailTimezone: emailTimezone || "Asia/Shanghai",
        lastSettingsChangeDate: new Date(),
        todaySettingsChangeCount: 1,
      },
      update: {
        recommendationMode: recommendationMode || "AI_MIXED",
        recommendationCount: recommendationCount || 10,
        includeGeneral: includeGeneral ?? true,
        emailEnabled: emailEnabled ?? true,
        emailTime: emailTime || "08:00",
        emailTimezone: emailTimezone || "Asia/Shanghai",
        lastSettingsChangeDate: new Date(),
        todaySettingsChangeCount: newCount,
      },
    });

    return NextResponse.json({
      success: true,
      remainingChanges: MAX_DAILY_SETTINGS_CHANGES - newCount,
    });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
