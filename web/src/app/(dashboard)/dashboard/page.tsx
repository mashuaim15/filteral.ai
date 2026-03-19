import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GenerateButton } from "@/components/dashboard/generate-button";
import { RecommendationImage } from "@/components/dashboard/recommendation-image";
import { Tier } from "@prisma/client";

// Daily generation limits based on tier
const DAILY_GENERATION_LIMITS: Record<Tier, number> = {
  FREE: 20,
  PRO: 20,
  MAX: 20,
};

const PLATFORM_META: Record<string, { icon: string; label: string }> = {
  YOUTUBE:  { icon: "▶",  label: "YOUTUBE" },
  BILIBILI: { icon: "📺", label: "BILIBILI" },
  REDDIT:   { icon: "↑",  label: "REDDIT" },
  X:        { icon: "𝕏",  label: "X" },
};

type RecType = { id: string; url: string; coverUrl: string | null; site: string; title: string; author: string; reason: string };

function FeaturedCard({ rec }: { rec: RecType }) {
  const meta = PLATFORM_META[rec.site] ?? { icon: "•", label: rec.site };
  return (
    <a
      href={rec.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors group"
    >
      <div className="aspect-video w-full">
        <RecommendationImage src={rec.coverUrl || ""} alt={rec.title} site={rec.site as any} />
      </div>
      <div className="p-4">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 truncate">
          {meta.icon} {meta.label} · {rec.author}
        </p>
        <h2 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-gray-600 dark:group-hover:text-gray-300 line-clamp-2 leading-snug mb-1">
          {rec.title}
        </h2>
        <p className="text-xs italic text-gray-400 dark:text-gray-500 line-clamp-2">
          {rec.reason}
        </p>
      </div>
    </a>
  );
}

function FeedCard({ rec }: { rec: RecType }) {
  const meta = PLATFORM_META[rec.site] ?? { icon: "•", label: rec.site };
  return (
    <a
      href={rec.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group"
    >
      <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden">
        <RecommendationImage src={rec.coverUrl || ""} alt={rec.title} site={rec.site as any} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5 truncate">
          {meta.icon} {meta.label} · {rec.author}
        </p>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-gray-600 dark:group-hover:text-gray-300 line-clamp-2 leading-snug mb-0.5">
          {rec.title}
        </h3>
        <p className="text-xs italic text-gray-400 dark:text-gray-500 line-clamp-2">
          {rec.reason}
        </p>
      </div>
    </a>
  );
}

export default async function DashboardPage() {
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { id: session?.user?.id },
    include: {
      preferences: true,
      persona: true,
      recommendations: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const preferences = user?.preferences;
  const countLimit = preferences?.recommendationCount || 10;
  const recommendations = (user?.recommendations || []).slice(0, countLimit);

  // Calculate remaining attempts based on subscription tier
  const maxDailyGenerations = user?.subscriptionTier
    ? DAILY_GENERATION_LIMITS[user.subscriptionTier]
    : DAILY_GENERATION_LIMITS.FREE;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastGenDate = preferences?.lastGeneratedDate
    ? new Date(preferences.lastGeneratedDate)
    : null;
  const isNewDay = !lastGenDate || lastGenDate < today;
  const todayCount = isNewDay ? 0 : preferences?.todayGenerationCount || 0;
  const remainingAttempts = maxDailyGenerations - todayCount;

  // Sort by importanceScore descending
  const sorted = [...recommendations].sort((a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0));

  // Pick featured: prefer highest-scored item with a real cover; fall back to first item
  const featured = sorted.find(r => !!r.coverUrl) ?? sorted[0] ?? null;
  const feedItems = featured ? sorted.filter(r => r.id !== featured.id) : sorted;

  // Balance two-column layout: distribute feedItems so columns end at similar heights.
  // FeaturedCard ≈ 4 FeedCard rows tall (aspect-video image + text at 42% col width).
  const FEATURED_ROW_EQUIV = 4;
  const N = feedItems.length;
  const rightCount = Math.min(N, Math.ceil((N + FEATURED_ROW_EQUIV) / 2));
  const rightItems = feedItems.slice(0, rightCount);
  const leftItems = feedItems.slice(rightCount);

  // Format date masthead
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-5xl">
      {/* Masthead */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-1">
            Filteral
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            {recommendations.length > 0
              ? `Your ${recommendations.length} pick${recommendations.length !== 1 ? "s" : ""} · ${dateStr}`
              : dateStr}
          </h1>
        </div>
        <div className="flex-shrink-0 pt-1">
          <GenerateButton remainingAttempts={remainingAttempts} />
        </div>
      </div>

      {/* Content */}
      {recommendations.length > 0 ? (
        featured ? (
          /* Desktop: two-column. Mobile: single-column feed */
          <div className="lg:grid lg:grid-cols-[42%_1fr] lg:gap-6 lg:items-start">
            {/* Left col — desktop only: FeaturedCard + overflow items below */}
            <div className="hidden lg:flex lg:flex-col lg:gap-2">
              <FeaturedCard rec={featured} />
              {leftItems.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800/80 overflow-hidden">
                  {leftItems.map(rec => <FeedCard key={rec.id} rec={rec} />)}
                </div>
              )}
            </div>

            {/* Right col — feed list. On mobile shows ALL items (featured first) */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800/80 overflow-hidden">
              {/* Mobile: featured as first FeedCard */}
              <div className="lg:hidden">
                <FeedCard rec={featured} />
              </div>
              {/* Mobile shows all feedItems; desktop shows only rightItems */}
              <div className="lg:hidden">
                {feedItems.map(rec => <FeedCard key={rec.id} rec={rec} />)}
              </div>
              <div className="hidden lg:block">
                {rightItems.map(rec => <FeedCard key={rec.id} rec={rec} />)}
              </div>
            </div>
          </div>
        ) : null
      ) : (
        <div className="p-12 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No recommendations yet. Generate your first set above.
          </p>
        </div>
      )}
    </div>
  );
}
