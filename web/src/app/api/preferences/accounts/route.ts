import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
      select: { followedAccounts: true },
    });

    if (!preferences?.followedAccounts) {
      return NextResponse.json({
        x: [],
        youtube: [],
        bilibili: [],
        wildSearch: [],
      });
    }

    const accounts = JSON.parse(preferences.followedAccounts);
    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { x, youtube, bilibili, wildSearch } = await request.json();

    const followedAccounts = JSON.stringify({
      x: x || [],
      youtube: youtube || [],
      bilibili: bilibili || [],
      wildSearch: wildSearch || [],
    });

    await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        followedAccounts,
      },
      update: {
        followedAccounts,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving accounts:", error);
    return NextResponse.json(
      { error: "Failed to save accounts" },
      { status: 500 }
    );
  }
}
