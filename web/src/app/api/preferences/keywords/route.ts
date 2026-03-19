import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { keywords } = await request.json();

    // Upsert user preferences with keywords
    await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        keywords: keywords || null,
      },
      update: {
        keywords: keywords || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving keywords:", error);
    return NextResponse.json(
      { error: "Failed to save keywords" },
      { status: 500 }
    );
  }
}
