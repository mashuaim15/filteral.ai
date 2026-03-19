import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { workerClient } from "@/lib/worker-client";
import { NextResponse } from "next/server";

const MAX_DAILY_INPUTS = 1;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { input } = await request.json();

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "Please provide some input" },
        { status: 400 }
      );
    }

    if (input.length > 1000) {
      return NextResponse.json(
        { error: "Input too long. Please keep it under 1000 characters." },
        { status: 400 }
      );
    }

    // Get existing persona
    let persona = await prisma.userPersona.findUnique({
      where: { userId: session.user.id },
    });

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastInputDate = persona?.lastInputDate
      ? new Date(persona.lastInputDate)
      : null;
    const isNewDay = !lastInputDate || lastInputDate < today;
    const todayCount = isNewDay ? 0 : persona?.todayInputCount || 0;

    if (todayCount >= MAX_DAILY_INPUTS) {
      return NextResponse.json(
        {
          error: "You've already shared today. Come back tomorrow!",
          compiledPersona: persona?.compiledPersona,
        },
        { status: 429 }
      );
    }

    // Get user's name and preferences for context
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { preferences: true },
    });

    // Extract persona using worker AI
    const extractedPersona = await workerClient.personaExtract(
      input,
      persona?.lastUserInput || undefined,
      persona?.viewingSignals || undefined,
      user?.preferences?.keywords || undefined
    );

    // Compile final persona
    const compiledPersona = compilePersona(extractedPersona);

    // Upsert persona
    persona = await prisma.userPersona.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        summary: extractedPersona.summary,
        interests: extractedPersona.interests,
        profession: extractedPersona.profession,
        expertise: extractedPersona.expertise,
        contentPref: extractedPersona.contentPref,
        lastUserInput: input,
        lastInputDate: new Date(),
        todayInputCount: 1,
        compiledPersona,
        lastCompiledAt: new Date(),
      },
      update: {
        summary: extractedPersona.summary,
        interests: extractedPersona.interests,
        profession: extractedPersona.profession,
        expertise: extractedPersona.expertise,
        contentPref: extractedPersona.contentPref,
        lastUserInput: input,
        lastInputDate: new Date(),
        todayInputCount: todayCount + 1,
        compiledPersona,
        lastCompiledAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      compiledPersona,
    });
  } catch (error) {
    console.error("Error processing persona:", error);
    return NextResponse.json(
      { error: "Failed to process your input. Please try again." },
      { status: 500 }
    );
  }
}

function compilePersona(extracted: { summary: string; profession: string; interests: string; contentPref: string }): string {
  const parts = [];

  if (extracted.summary) {
    parts.push(extracted.summary);
  }

  if (extracted.profession && extracted.profession !== "Not specified") {
    parts.push(`Works as: ${extracted.profession}.`);
  }

  if (extracted.interests) {
    parts.push(`Interested in: ${extracted.interests}.`);
  }

  if (extracted.contentPref) {
    parts.push(`Prefers: ${extracted.contentPref}.`);
  }

  return parts.join(" ").slice(0, 1000);
}

// GET endpoint to fetch current persona
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const persona = await prisma.userPersona.findUnique({
    where: { userId: session.user.id },
  });

  // Check if can submit today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastInputDate = persona?.lastInputDate
    ? new Date(persona.lastInputDate)
    : null;
  const isNewDay = !lastInputDate || lastInputDate < today;
  const canSubmitToday = isNewDay || (persona?.todayInputCount || 0) < MAX_DAILY_INPUTS;

  return NextResponse.json({
    compiledPersona: persona?.compiledPersona || null,
    canSubmitToday,
  });
}
