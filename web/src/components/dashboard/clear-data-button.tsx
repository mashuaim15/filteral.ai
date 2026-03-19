"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClearDataButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClear() {
    const confirmed = confirm(
      "This will permanently delete all your recommendations, platform connections, persona, and preferences. You will stay logged in but start completely fresh.\n\nAre you sure?"
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch("/api/user/clear-data", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear data");
      }
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to clear data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClear}
      disabled={loading}
      className="px-3 py-1.5 text-sm font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
    >
      {loading ? "Clearing..." : "Clear All Data"}
    </button>
  );
}
