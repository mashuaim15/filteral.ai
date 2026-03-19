"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AgentTerminal, TerminalLine } from "./agent-terminal";

interface GenerateButtonProps {
  remainingAttempts?: number;
}

function formatEvent(event: Record<string, any>): TerminalLine | null {
  switch (event.type) {
    case "thinking":
      return { type: "thinking", text: event.content };
    case "tool_call":
      return { type: "tool_call", text: `$ ${event.tool}` };
    case "candidates":
      return {
        type: "candidates" as TerminalLine["type"],
        text: (event.titles as string[]).map((t) => `  · ${t}`).join("\n"),
      };
    case "tool_result":
      if ("submitted" in event) {
        return { type: "tool_result", text: `  → submitted ${event.submitted} items` };
      }
      return { type: "tool_result", text: `  → ${event.count} results` };
    case "done":
      return { type: "done", text: `✓ ${event.count} recommendations ready` };
    case "error":
      return { type: "error", text: `✗ ${event.message}` };
    default:
      return null;
  }
}

export function GenerateButton({ remainingAttempts = 2 }: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [fading, setFading] = useState(false);
  const router = useRouter();
  const generatingRef = useRef(false);

  const addLine = useCallback((line: TerminalLine) => {
    setLines((prev) => {
      // Spinner thinking lines (⠋…⠏ prefix) replace the previous thinking line in-place
      const isSpinner = line.type === "thinking" && /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(line.text);
      if (isSpinner && prev.length > 0 && prev[prev.length - 1].type === "thinking") {
        return [...prev.slice(0, -1), line];
      }
      return [...prev, line];
    });
  }, []);

  const handleGenerate = async () => {
    if (remainingAttempts <= 0) {
      setError("Daily limit reached. Try again tomorrow!");
      return;
    }
    if (generatingRef.current) return;

    generatingRef.current = true;
    setLoading(true);
    setError(null);
    setLines([]);
    setFading(false);

    let response: Response;
    try {
      response = await fetch("/api/recommendations/generate", { method: "POST" });
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
      generatingRef.current = false;
      return;
    }

    // Only open modal after confirmed SSE stream.
    // Note: use ! on the whole expression — if Content-Type is absent, ?.includes returns
    // undefined, which is falsy, correctly treating a missing header as a failure.
    if (!response.ok || !response.headers.get("Content-Type")?.includes("text/event-stream")) {
      const data = await response.json().catch(() => ({}));
      setError((data as any).error || "Failed to generate recommendations");
      setLoading(false);
      generatingRef.current = false;
      return;
    }

    setShowModal(true);

    // Read SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";

        for (const message of messages) {
          const line = message.trim();
          if (!line.startsWith("data: ")) continue;

          let event: Record<string, any>;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          const terminalLine = formatEvent(event);
          if (terminalLine) addLine(terminalLine);

          if (event.type === "done") {
            setLoading(false);
            generatingRef.current = false;
            setTimeout(() => {
              setFading(true);
              setTimeout(() => {
                setShowModal(false);
                setFading(false);
                router.refresh();
              }, 500);
            }, 5000);
            return;
          }

          if (event.type === "error") {
            setLoading(false);
            generatingRef.current = false;
            return;
          }
        }
      }
    } catch {
      addLine({ type: "error", text: "[error] Stream interrupted" });
      setLoading(false);
      generatingRef.current = false;
      return;
    }

    // Stream closed without a done or error event — defensive cleanup
    addLine({ type: "error", text: "[error] Generation ended unexpectedly" });
    setLoading(false);
    generatingRef.current = false;
  };

  const handleClose = useCallback(() => {
    if (!loading) {
      setShowModal(false);
      setLines([]);
    }
  }, [loading]);

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          {remainingAttempts <= 2 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {remainingAttempts} left today
            </span>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading || remainingAttempts <= 0}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            {loading && (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white dark:border-gray-900/30 dark:border-t-gray-900" />
            )}
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      {showModal && (
        <AgentTerminal
          lines={lines}
          generating={loading}
          fading={fading}
          onClose={handleClose}
        />
      )}
    </>
  );
}
