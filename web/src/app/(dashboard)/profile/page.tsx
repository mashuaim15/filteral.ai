import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PersonaInput } from "@/components/dashboard/persona-input";
import { KeywordsInput } from "@/components/dashboard/keywords-input";
import { AIConfigInput } from "@/components/dashboard/ai-config-input";
import { AccountsInput } from "@/components/dashboard/accounts-input";

export default async function ProfilePage() {
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { id: session?.user?.id },
    select: {
      name: true,
      subscriptionTier: true,
      preferences: true,
      persona: true,
    },
  });

  // Check if can submit persona today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastInputDate = user?.persona?.lastInputDate
    ? new Date(user.persona.lastInputDate)
    : null;
  const isNewDay = !lastInputDate || lastInputDate < today;
  const canSubmitPersonaToday =
    isNewDay || (user?.persona?.todayInputCount || 0) < 1;

  // Fetch a diverse sample of authors from recent recommendations
  const recentRecs = await prisma.recommendation.findMany({
    where: { userId: session!.user!.id },
    select: { author: true, site: true, url: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const seenAuthors = new Set<string>();
  const platformCounts: Record<string, number> = {};
  const sampledAuthors: { author: string; site: string; url: string }[] = [];
  for (const rec of recentRecs) {
    const key = `${rec.site}:${rec.author}`;
    const count = platformCounts[rec.site] ?? 0;
    if (!seenAuthors.has(key) && count < 2 && sampledAuthors.length < 6) {
      seenAuthors.add(key);
      platformCounts[rec.site] = count + 1;
      sampledAuthors.push(rec);
    }
  }

  // Parse followed accounts from preferences
  let initialAccounts = { x: [], youtube: [], bilibili: [], wildSearch: [] } as {
    x: string[];
    youtube: string[];
    bilibili: string[];
    wildSearch: string[];
  };
  if (user?.preferences?.followedAccounts) {
    try {
      initialAccounts = JSON.parse(user.preferences.followedAccounts);
    } catch {
      // Keep empty defaults on parse error
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Your Profile
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Tell us about yourself so we can find content you&apos;ll love.
        </p>
      </div>

      {/* AI Model Configuration - first */}
      <div className="mb-6">
        <AIConfigInput
          initialModel={user?.preferences?.aiModel || "claude-sonnet-4-6"}
          hasApiKey={!!user?.preferences?.aiApiKey}
          subscriptionTier={user?.subscriptionTier}
        />
      </div>

      {/* Persona Input - second */}
      <div className="mb-6">
        <PersonaInput
          userName={user?.name || ""}
          initialPersona={user?.persona?.compiledPersona || null}
          canSubmitToday={canSubmitPersonaToday}
        />
      </div>

      {/* Keywords Input */}
      <div className="mb-6">
        <KeywordsInput initialKeywords={user?.preferences?.keywords || ""} />
      </div>

      {/* Followed Accounts - third */}
      <div className="mb-6">
        <AccountsInput initialAccounts={initialAccounts} />
      </div>

      {/* Current persona display */}
      {user?.persona?.compiledPersona && (
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <span>🧠</span>
            How Filteral Sees You
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 italic">
            {user.persona.compiledPersona}
          </p>
          {sampledAuthors.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                Creators Filteral found for you
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sampledAuthors.map(({ author, site, url }) => {
                  const icon = site === "YOUTUBE" ? "▶" : site === "BILIBILI" ? "🅱" : site === "X" ? "𝕏" : "↗";
                  return (
                    <a
                      key={`${site}:${author}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <span>{icon}</span>
                      <span>{author}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            This persona is built from what you tell us and your viewing history. It gets smarter over time.
          </p>
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-500 dark:text-gray-400">
        <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tips for better recommendations
        </p>
        <ul className="space-y-1.5 list-disc list-inside">
          <li>Be specific about your interests and profession</li>
          <li>Mention topics you want to learn about</li>
          <li>Add keywords for niche topics you follow</li>
          <li>Come back daily to refine your profile</li>
        </ul>
      </div>
    </div>
  );
}
