"use client";

import { useEffect, useRef, useState } from "react";

export interface TerminalLine {
  type: "thinking" | "tool_call" | "tool_result" | "candidates" | "done" | "error";
  text: string;
}

interface AgentTerminalProps {
  lines: TerminalLine[];
  generating: boolean; // true while streaming, false after done/error
  fading: boolean;     // true when fading out after done
  onClose: () => void;
}

export function AgentTerminal({ lines, generating, fading, onClose }: AgentTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const [typingState, setTypingState] = useState<{ lineIndex: number; revealed: number } | null>(null);

  // Detect new non-spinner thinking lines and start typewriter
  useEffect(() => {
    if (lines.length > prevLengthRef.current) {
      const newLine = lines[lines.length - 1];
      const isSpinner = /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(newLine.text);
      if (newLine.type === "thinking" && !isSpinner) {
        setTypingState({ lineIndex: lines.length - 1, revealed: 0 });
      }
    }
    prevLengthRef.current = lines.length;
  }, [lines.length]);

  // Drive the typewriter tick
  useEffect(() => {
    if (!typingState) return;
    const line = lines[typingState.lineIndex];
    if (!line || typingState.revealed >= line.text.length) {
      setTypingState(null);
      return;
    }
    const timer = setTimeout(() => {
      setTypingState((s) => (s ? { ...s, revealed: s.revealed + 3 } : null));
    }, 12);
    return () => clearTimeout(timer);
  }, [typingState, lines]);

  // Auto-scroll to bottom whenever lines change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Escape key closes only when not generating
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !generating) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [generating, onClose]);

  const lineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "thinking":
        return "text-gray-200";
      case "tool_call":
        return "text-gray-400";
      case "tool_result":
        return "text-gray-600";
      case "candidates":
        return "text-gray-700";
      case "done":
        return "text-green-400";
      case "error":
        return "text-red-400";
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}>
      {/* Backdrop — click disabled during generation */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={generating ? undefined : onClose}
      />

      {/* Terminal window */}
      <div className="relative bg-[#0f0f0f] rounded-lg shadow-xl border border-gray-800 max-w-xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
          <span className="text-xs font-mono uppercase tracking-widest text-gray-600">
            filteral agent
          </span>
          <span
            className={`text-xs font-mono ${
              generating ? "text-gray-800" : "text-gray-600 hover:text-gray-400 cursor-pointer"
            }`}
            onClick={generating ? undefined : onClose}
          >
            [esc]
          </span>
        </div>

        {/* Terminal body */}
        <div
          ref={scrollRef}
          className="max-h-[480px] overflow-y-auto p-4 space-y-0.5 font-mono text-sm"
        >
          {lines.length === 0 && (
            <span className="text-gray-700">initializing…</span>
          )}
          {lines.map((line, i) => {
            const isTyping = typingState?.lineIndex === i;
            const displayText = isTyping ? line.text.slice(0, typingState!.revealed) : line.text;
            return (
              <div key={i} className={`leading-relaxed whitespace-pre-wrap break-words ${lineColor(line.type)}`}>
                {displayText}
                {isTyping && <span className="opacity-70">▋</span>}
              </div>
            );
          })}
          {/* Close button — shown after error when generation is no longer running */}
          {!generating && lines.some((l) => l.type === "error") && (
            <div className="pt-3">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-mono rounded border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
              >
                [close]
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
