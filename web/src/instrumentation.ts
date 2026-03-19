/**
 * Next.js Instrumentation
 * Runs on server startup - used to initialize background services.
 */

async function applyMigration(attempt = 0): Promise<void> {
  try {
    const { prisma } = await import("./lib/db");
    await prisma.$executeRaw`ALTER TABLE "UserPreferences" ADD COLUMN IF NOT EXISTS "aiModel" TEXT`;
    await prisma.$executeRaw`ALTER TABLE "UserPreferences" ADD COLUMN IF NOT EXISTS "aiApiKey" TEXT`;
    await prisma.$executeRaw`ALTER TABLE "UserPreferences" ADD COLUMN IF NOT EXISTS "followedAccounts" TEXT`;
    console.log("Schema migration applied successfully");
  } catch (e) {
    if (attempt < 5) {
      const delay = Math.min(2000 * 2 ** attempt, 30000);
      console.warn(`Schema migration attempt ${attempt + 1} failed, retrying in ${delay}ms`);
      setTimeout(() => applyMigration(attempt + 1), delay);
    } else {
      console.error("Schema migration failed after all retries:", e);
    }
  }
}

export async function register() {
  // Only run on the server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Run migration in background — never blocks startup or crashes the process
    applyMigration();

    const { startEmailScheduler } = await import("./lib/email-scheduler");
    startEmailScheduler();
  }
}
