"use client";

import { useState } from "react";

interface RecommendationImageProps {
  src?: string;
  alt: string;
  site: string;
}

// Platform-specific colors and icons
const PLATFORM_STYLES: Record<string, { bg: string; icon: string }> = {
  YOUTUBE: { bg: "bg-red-100 dark:bg-red-900/30", icon: "▶️" },
  BILIBILI: { bg: "bg-pink-100 dark:bg-pink-900/30", icon: "📺" },
  REDDIT: { bg: "bg-orange-100 dark:bg-orange-900/30", icon: "🔴" },
  X: { bg: "bg-gray-100 dark:bg-gray-800", icon: "𝕏" },
};

const DEFAULT_STYLE = { bg: "bg-gray-100 dark:bg-gray-800", icon: "📄" };

export function RecommendationImage({ src, alt, site }: RecommendationImageProps) {
  const [hasError, setHasError] = useState(false);
  const style = PLATFORM_STYLES[site] || DEFAULT_STYLE;

  // Show fallback if no src or error loading
  if (!src || hasError) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${style.bg}`}>
        <span className="text-3xl">{style.icon}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setHasError(true)}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  );
}
