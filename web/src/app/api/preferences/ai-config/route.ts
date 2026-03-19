import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptApiKey } from "@/lib/crypto";

const ALLOWED_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-haiku-4-5",
  "gpt-4o",
  "gpt-4o-mini",
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { model, apiKey } = body as { model?: string; apiKey?: string | null };

  // Validate model
  if (model !== undefined && !ALLOWED_MODELS.includes(model)) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (model !== undefined) {
    updateData.aiModel = model;
  }

  if (apiKey === null) {
    // Clear the key
    updateData.aiApiKey = null;
  } else if (typeof apiKey === "string" && apiKey.trim().length > 0) {
    updateData.aiApiKey = encryptApiKey(apiKey.trim());
  }

  await prisma.userPreferences.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...updateData },
    update: updateData,
  });

  const updated = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id },
    select: { aiModel: true, aiApiKey: true },
  });

  return NextResponse.json({
    success: true,
    hasApiKey: !!updated?.aiApiKey,
  });
}
