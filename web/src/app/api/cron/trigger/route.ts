import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendScheduledEmails } from "@/lib/email-scheduler";

// Manual trigger for testing the email scheduler
// Only works in development or for admin users

export async function POST() {
  // In production, require auth
  if (process.env.NODE_ENV === "production") {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    console.log("[CronTrigger] Manually triggering email scheduler...");
    const result = await sendScheduledEmails();
    return NextResponse.json({
      success: true,
      message: "Email scheduler triggered",
      ...result,
    });
  } catch (error) {
    console.error("[CronTrigger] Error:", error);
    return NextResponse.json(
      { error: "Failed to run scheduler", details: String(error) },
      { status: 500 }
    );
  }
}
