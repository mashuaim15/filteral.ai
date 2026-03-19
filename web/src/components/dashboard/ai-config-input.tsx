"use client";

import { useState } from "react";

const IS_SELF_HOSTED = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === "self-hosted";

const MODELS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (default)" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

interface AIConfigInputProps {
  initialModel: string;
  hasApiKey: boolean;
  subscriptionTier?: string;
}

export function AIConfigInput({ initialModel, hasApiKey: initialHasApiKey, subscriptionTier }: AIConfigInputProps) {
  const [model, setModel] = useState(initialModel || "claude-sonnet-4-6");
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(initialHasApiKey);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);

  const isMax = subscriptionTier === "MAX";

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const body: { model: string; apiKey?: string } = { model };
      if (apiKey.trim()) {
        body.apiKey = apiKey.trim();
      }
      const response = await fetch("/api/preferences/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data = await response.json();
        setHasApiKey(data.hasApiKey);
        setApiKey("");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const response = await fetch("/api/preferences/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: null }),
      });
      if (response.ok) {
        setHasApiKey(false);
        setApiKey("");
      }
    } catch {
      // Silent fail
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🤖</span>
        <h3 className="font-medium text-gray-900 dark:text-white">
          AI Model Configuration
        </h3>
        {IS_SELF_HOSTED ? (
          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">(required)</span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">(optional)</span>
        )}
      </div>

      {isMax ? (
        /* MAX tier — system key included */
        <div className="px-3 py-2.5 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            Max Plan — Anthropic claude-sonnet-4-6 is included. No API key needed.
          </p>
        </div>
      ) : (
        /* PRO / FREE tier */
        <>
          {IS_SELF_HOSTED && !hasApiKey && (
            <div className="mb-3 px-3 py-2 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <p className="text-xs text-orange-700 dark:text-orange-400">
                You must provide an API key — this instance has no built-in key.
              </p>
            </div>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Choose which AI model powers your recommendations and optionally provide your own API key.
          </p>

          {/* Model selector */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#191919] text-gray-900 dark:text-white focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* API key input */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasApiKey ? "••••••••••••••••" : "sk-... or sk-ant-..."}
                className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#191919] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-2 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : saved ? "Saved!" : "Save"}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              Your key is encrypted end-to-end using AES-256-GCM before being stored. It is never logged or transmitted in plain text.
            </p>
          </div>

          {/* Key status */}
          {hasApiKey && !apiKey && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                Key configured ✓
              </span>
              <button
                onClick={handleClear}
                disabled={clearing}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
              >
                {clearing ? "Clearing..." : "Clear"}
              </button>
            </div>
          )}

          {/* Upgrade to Max card */}
          <div className="mt-3 px-3 py-2.5 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No API key? Upgrade to Max — get Anthropic&apos;s claude-sonnet-4-6 included for $1.99/month or $15/year.
            </p>
            <a
              href="mailto:hello@filteral.app?subject=Max+Membership"
              className="flex-shrink-0 text-xs font-medium text-gray-900 dark:text-white hover:underline whitespace-nowrap"
            >
              Upgrade to Max →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
