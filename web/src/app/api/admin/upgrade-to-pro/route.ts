import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendProWelcomeEmail } from "@/lib/email";

/**
 * Upgrade a user to PRO tier and send welcome email.
 *
 * POST /api/admin/upgrade-to-pro
 * Body: { email: string }
 *
 * This endpoint requires admin authentication (ADMIN_SECRET header).
 */
export async function POST(request: Request) {
  // Check admin secret
  const authHeader = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already PRO
    if (user.subscriptionTier === "PRO") {
      return NextResponse.json({
        error: "User is already PRO",
        user: { email: user.email, tier: user.subscriptionTier }
      }, { status: 400 });
    }

    // Upgrade to PRO
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: "PRO" },
    });

    // Send welcome email
    const emailSent = await sendProWelcomeEmail(
      user.email!,
      user.name || "there"
    );

    console.log(`[Admin] Upgraded ${email} to PRO, welcome email sent: ${emailSent}`);

    return NextResponse.json({
      success: true,
      user: {
        email: updatedUser.email,
        name: updatedUser.name,
        tier: updatedUser.subscriptionTier,
      },
      welcomeEmailSent: emailSent,
    });
  } catch (error) {
    console.error("[Admin] Upgrade to PRO error:", error);
    return NextResponse.json(
      { error: "Failed to upgrade user" },
      { status: 500 }
    );
  }
}
