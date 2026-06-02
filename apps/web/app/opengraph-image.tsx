import { ImageResponse } from "next/og";

// Branded social-share card. Edge runtime + inline styles + system fonts only
// (no external font fetch) so the image always renders without a network
// dependency at build/request time.
export const runtime = "edge";

export const alt = "Pervagans";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#0a0a0c",
          padding: "96px",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 132,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "#ffffff",
            lineHeight: 1,
          }}
        >
          Pervagans
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 40,
            fontWeight: 400,
            color: "#9aa0aa",
            lineHeight: 1.2,
          }}
        >
          AI workspace · instructions · files · skills · connectors
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
