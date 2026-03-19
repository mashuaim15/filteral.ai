"use client";

import { useState, useRef, KeyboardEvent } from "react";

interface AccountsData {
  x: string[];
  youtube: string[];
  bilibili: string[];
  wildSearch: string[];
}

interface AccountsInputProps {
  initialAccounts?: AccountsData;
}

const PLATFORMS: {
  key: keyof AccountsData;
  label: string;
  icon: string;
  placeholder: string;
}[] = [
  { key: "x", label: "X (Twitter)", icon: "𝕏", placeholder: "e.g. elonmusk" },
  { key: "youtube", label: "YouTube", icon: "▶", placeholder: "e.g. MrBeast" },
  { key: "bilibili", label: "Bilibili", icon: "🅱", placeholder: "e.g. 影视飓风" },
  { key: "wildSearch", label: "Wild Search", icon: "🔍", placeholder: "e.g. AI news, crypto" },
];

function TagChipRow({
  platform,
  tags,
  onAdd,
  onRemove,
}: {
  platform: (typeof PLATFORMS)[number];
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commitTag = () => {
    const trimmed = inputValue.trim().replace(/,+$/, "").trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setInputValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTag();
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      onRemove(tags[tags.length - 1]);
    }
  };

  const handleChange = (value: string) => {
    if (value.includes(",")) {
      const parts = value.split(",");
      const toCommit = parts.slice(0, -1);
      toCommit.forEach((part) => {
        const trimmed = part.trim();
        if (trimmed && !tags.includes(trimmed)) {
          onAdd(trimmed);
        }
      });
      setInputValue(parts[parts.length - 1]);
    } else {
      setInputValue(value);
    }
  };

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex items-center gap-2 w-32 shrink-0 pt-1.5">
        <span className="text-sm font-medium">{platform.icon}</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {platform.label}
        </span>
      </div>
      <div
        className="flex-1 flex flex-wrap gap-1.5 min-h-[36px] px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#191919] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tag);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitTag}
          placeholder={tags.length === 0 ? platform.placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
        />
      </div>
    </div>
  );
}

export function AccountsInput({ initialAccounts }: AccountsInputProps) {
  const [accounts, setAccounts] = useState<AccountsData>(
    initialAccounts ?? { x: [], youtube: [], bilibili: [], wildSearch: [] }
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleAdd = (platform: keyof AccountsData, tag: string) => {
    setAccounts((prev) => ({
      ...prev,
      [platform]: [...prev[platform], tag],
    }));
  };

  const handleRemove = (platform: keyof AccountsData, tag: string) => {
    setAccounts((prev) => ({
      ...prev,
      [platform]: prev[platform].filter((t) => t !== tag),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch("/api/preferences/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accounts),
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
        <span className="text-lg">👥</span>
        <h3 className="font-medium text-gray-900 dark:text-white">
          Followed Accounts
        </h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          (optional)
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Add accounts or channels you follow. Press Enter or comma to add each one.
      </p>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {PLATFORMS.map((platform) => (
          <TagChipRow
            key={platform.key}
            platform={platform}
            tags={accounts[platform.key]}
            onAdd={(tag) => handleAdd(platform.key, tag)}
            onRemove={(tag) => handleRemove(platform.key, tag)}
          />
        ))}
      </div>

      <div className="mt-4 flex justify-end">
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
