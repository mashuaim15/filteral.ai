import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { ClearDataButton } from "@/components/dashboard/clear-data-button";

const MAX_DAILY_SETTINGS_CHANGES = 999; // Temporarily disabled for development

export default async function SettingsPage() {
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { id: session?.user?.id },
    include: { preferences: true },
  });

  const preferences = user?.preferences;

  // Calculate remaining settings changes
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastChangeDate = preferences?.lastSettingsChangeDate
    ? new Date(preferences.lastSettingsChangeDate)
    : null;
  const isNewDay = !lastChangeDate || lastChangeDate < today;
  const todayCount = isNewDay ? 0 : preferences?.todaySettingsChangeCount || 0;
  const remainingChanges = MAX_DAILY_SETTINGS_CHANGES - todayCount;

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage your account and preferences.
        </p>
      </div>

      <SettingsForm
        user={{
          email: user?.email || null,
          name: user?.name || null,
          subscriptionTier: user?.subscriptionTier || "FREE",
        }}
        preferences={
          preferences
            ? {
                recommendationMode: preferences.recommendationMode,
                recommendationCount: preferences.recommendationCount,
                includeGeneral: preferences.includeGeneral,
                emailEnabled: preferences.emailEnabled,
                emailTime: preferences.emailTime,
                emailTimezone: preferences.emailTimezone,
              }
            : null
        }
        remainingChanges={remainingChanges}
      />

      {/* Danger Zone */}
      <section className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-4">
          Danger Zone
        </h2>
        <div className="flex gap-3">
          <ClearDataButton />
          <button className="px-3 py-1.5 text-sm font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors">
            Delete Account
          </button>
        </div>
      </section>
    </div>
  );
}
