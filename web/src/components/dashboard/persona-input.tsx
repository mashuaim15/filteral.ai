"use client";

import { useState } from "react";

interface PersonaInputProps {
  userName: string;
  initialPersona: string | null;
  canSubmitToday: boolean;
}

export function PersonaInput({
  userName,
  initialPersona,
  canSubmitToday: initialCanSubmit,
}: PersonaInputProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(!initialCanSubmit);
  const [error, setError] = useState("");
  const [currentPersona, setCurrentPersona] = useState(initialPersona);

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError("Please tell us something about yourself!");
      return;
    }

    if (text.trim().length < 20) {
      setError("Please write a bit more so we can understand you better!");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save. Please try again.");
        return;
      }

      setSubmitted(true);
      setCurrentPersona(data.compiledPersona);
      setText("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const firstName = userName?.split(" ")[0] || "there";

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-[#1a1a1a]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">👤</span>
        <h3 className="font-medium text-gray-900 dark:text-white">
          Your Filteral Persona
        </h3>
      </div>

      {submitted ? (
        // Already submitted today
        <div>
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-3">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm font-medium">
              Got it, thanks for sharing!
            </span>
          </div>
          {currentPersona && (
            <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-md p-3">
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                How we see you:
              </p>
              <p className="italic">{currentPersona}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            Come back tomorrow to tell us more!
          </p>
        </div>
      ) : (
        // Input form
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Hey {firstName}, tell me about yourself! What do you do? What are
            you interested in? This helps us find content you&apos;ll love.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g., I'm a software engineer learning about AI and machine learning. I love indie games and following startup news. Looking for deep technical content, not clickbait..."
            rows={3}
            maxLength={1000}
            className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#191919] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{text.length}/1000</span>
            <button
              onClick={handleSubmit}
              disabled={saving || !text.trim()}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Processing..." : "Share with Filteral"}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
