import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Filteral - Your Personal AI Information Filter";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#191919",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <svg
            width="80"
            height="80"
            viewBox="0 0 100 100"
            fill="none"
            style={{ marginRight: 20 }}
          >
            <circle cx="50" cy="50" r="45" fill="white" />
            <path
              d="M30 35 L50 65 L70 35"
              stroke="#191919"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            Filteral
            <span style={{ color: "#9ca3af" }}>.app</span>
          </span>
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#9ca3af",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          Your Personal AI Information Filter
        </div>
        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 40,
            fontSize: 24,
            color: "#6b7280",
          }}
        >
          <span>Bilibili</span>
          <span>YouTube</span>
          <span>Reddit</span>
          <span>X</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
