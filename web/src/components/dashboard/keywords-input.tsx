"use client";

import { useState } from "react";

interface KeywordsInputProps {
  initialKeywords: string;
}

export function KeywordsInput({ initialKeywords }: KeywordsInputProps) {
  const [keywords, setKeywords] = useState(initialKeywords);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch("/api/preferences/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🔍</span>
        <h3 className="font-medium text-gray-900 dark:text-white">
          Interest Keywords
        </h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          (optional)
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Add keywords to help discover content across platforms. Used especially
        for Reddit.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="e.g., AI, startups, programming, design"
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
    </div>
  );
}
