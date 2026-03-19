"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SettingsFormProps {
  user: {
    email: string | null;
    name: string | null;
    subscriptionTier: string;
  };
  preferences: {
    recommendationMode: string;
    recommendationCount: number;
    includeGeneral: boolean;
    emailEnabled: boolean;
    emailTime: string;
    emailTimezone: string;
  } | null;
  remainingChanges: number;
}

export function SettingsForm({
  user,
  preferences,
  remainingChanges: initialRemaining,
}: SettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [remainingChanges, setRemainingChanges] = useState(initialRemaining);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<"idle" | "success" | "error">("idle");

  // Form state
  const [name, setName] = useState(user.name || "");
  const [recommendationCount, setRecommendationCount] = useState(
    preferences?.recommendationCount || 10
  );
  const [includeGeneral, setIncludeGeneral] = useState(
    preferences?.includeGeneral ?? true
  );
  const [emailEnabled, setEmailEnabled] = useState(
    preferences?.emailEnabled ?? true
  );
  const [emailTime, setEmailTime] = useState(
    preferences?.emailTime || "08:00"
  );
  const [emailTimezone, setEmailTimezone] = useState(
    preferences?.emailTimezone || "Asia/Shanghai"
  );

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setEmailTestStatus("idle");

    try {
      const response = await fetch("/api/test-email", {
        method: "POST",
      });

      if (response.ok) {
        setEmailTestStatus("success");
        setTimeout(() => setEmailTestStatus("idle"), 5000);
      } else {
        setEmailTestStatus("error");
      }
    } catch {
      setEmailTestStatus("error");
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSave = async () => {
    if (remainingChanges <= 0) {
      setStatus("error");
      setErrorMessage("Daily limit reached. You can change settings up to 3 times per day.");
      return;
    }

    setSaving(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      const response = await fetch("/api/preferences/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          recommendationCount: Number(recommendationCount),
          includeGeneral,
          emailEnabled,
          emailTime,
          emailTimezone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Failed to save settings");
        return;
      }

      setStatus("success");
      setRemainingChanges(data.remainingChanges);
      router.refresh();

      // Reset success message after 3 seconds
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Account */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Account
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user.email || ""}
              disabled
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#191919] text-gray-900 dark:text-white text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
            />
          </div>
        </div>
      </section>

      {/* Recommendations */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Recommendations
        </h2>
        <div className="space-y-4">
          <div>
            <select
              value={recommendationCount}
              onChange={(e) => setRecommendationCount(Number(e.target.value))}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#191919] text-gray-900 dark:text-white"
            >
              <option value={10}>10 recommendations</option>
              <option value={20}>20 recommendations</option>
              <option value={30}>30 recommendations</option>
            </select>
          </div>

          {/* Include exploration */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeGeneral}
              onChange={(e) => setIncludeGeneral(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Include trending/popular content (30% exploration)
            </span>
          </label>
        </div>
      </section>

      {/* Email */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Email Delivery
        </h2>
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Send daily recommendations via email
            </span>
          </label>
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time
              </label>
              <select
                value={emailTime}
                onChange={(e) => setEmailTime(e.target.value)}
                className="px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#191919] text-gray-900 dark:text-white text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
              >
                {Array.from({ length: 24 }, (_, hour) =>
                  [0, 10, 20, 30, 40, 50].map((minute) => {
                    const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                    const ampm = hour < 12 ? "AM" : "PM";
                    return (
                      <option key={time} value={time}>
                        {displayHour}:{minute.toString().padStart(2, "0")} {ampm}
                      </option>
                    );
                  })
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Timezone
              </label>
              <select
                value={emailTimezone}
                onChange={(e) => setEmailTimezone(e.target.value)}
                className="px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#191919] text-gray-900 dark:text-white text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
              >
                <option value="Asia/Shanghai">Shanghai (UTC+8)</option>
                <option value="America/New_York">New York (UTC-5)</option>
                <option value="America/Los_Angeles">Los Angeles (UTC-8)</option>
                <option value="Europe/London">London (UTC+0)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testingEmail}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {testingEmail
                ? "Sending..."
                : user.subscriptionTier === "PRO"
                ? "Send Recommendations Email"
                : "Send Test Email"}
            </button>
            {emailTestStatus === "success" && (
              <span className="text-sm text-green-600 dark:text-green-400">
                Email sent! Check your inbox.
              </span>
            )}
            {emailTestStatus === "error" && (
              <span className="text-sm text-red-600 dark:text-red-400">
                Failed to send email.
              </span>
            )}
            <span className="text-xs text-gray-400">
              10/day
            </span>
          </div>
        </div>
      </section>

      {/* Subscription */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Subscription
        </h2>
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800">
          {user.subscriptionTier === "MAX" ? (
            <>
              <p className="font-medium text-gray-900 dark:text-white">Max Plan — Anthropic claude-sonnet-4-6 included · $1.99/mo</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Up to 30 recommendations per day, no API key required
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-gray-900 dark:text-white">Pro Plan — Free · Bring your own API key</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Up to 30 recommendations per day, unlimited access
              </p>
              <a
                href="mailto:hello@filteral.app?subject=Max+Membership"
                className="inline-flex items-center text-sm font-medium text-gray-900 dark:text-white hover:underline"
              >
                Upgrade to Max →
              </a>
            </>
          )}
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || remainingChanges <= 0}
          className="px-4 py-2 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>

        {/* Status messages */}
        {status === "success" && (
          <span className="text-sm text-green-600 dark:text-green-400">
            Settings saved successfully!
          </span>
        )}
        {status === "error" && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </span>
        )}

        {/* Remaining changes indicator */}
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {remainingChanges} changes left today
        </span>
      </div>
    </>
  );
}
