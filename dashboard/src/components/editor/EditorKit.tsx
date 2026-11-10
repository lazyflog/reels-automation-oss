"use client";

import { ReactNode, CSSProperties, useEffect, useState } from "react";

/** Whether the screen is narrow (mobile) — used to switch the modal layout to vertical scrolling. */
export function useIsNarrow(breakpoint = 640): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return narrow;
}

// Prototype (siteDesign.dc.html) palette
export const SWATCHES = [
  "#ffffff", "#000000", "#f5b400", "#f97316", "#ef4444", "#22c55e",
  "#84cc16", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
];

// Map 1080px-wide video to container width → convert px to cqw (1cqw ≈ 10.8px)
const PX_TO_CQW = 10.8;

export interface TextStyleOpts {
  text: string;
  font: string;          // CSS font-family (approximation for preview)
  size: number;          // px (relative to 1080)
  color: string;
  bold: boolean;
  italic: boolean;
  topPct: number;        // vertical position 0–100 (%)
  strokeColor?: string | null;
  strokeWidth?: number;  // px
  shadow?: boolean;
  shadowOffset?: number; // px
  shadowBlur?: number;   // px
  bgColor?: string | null;
}

/** Text CSS for the 9:16 live preview (based on container query width). */
export function buildTextStyle(o: TextStyleOpts): CSSProperties {
  const stroke = o.strokeWidth && o.strokeWidth > 0 && o.strokeColor;
  let textShadow = "none";
  if (o.shadow) {
    const off = (o.shadowOffset ?? 3) / PX_TO_CQW;
    const blur = ((o.shadowBlur ?? 2) * 2) / PX_TO_CQW;
    textShadow = `${off}cqw ${off}cqw ${blur}cqw rgba(0,0,0,.7)`;
  }
  return {
    position: "absolute",
    left: "50%",
    top: `${o.topPct}%`,
    transform: "translate(-50%,-50%)",
    margin: 0,
    width: "90%",
    textAlign: "center",
    fontFamily: `'${o.font}', 'Pretendard', sans-serif`,
    fontWeight: o.bold ? 700 : 400,
    fontStyle: o.italic ? "italic" : "normal",
    fontSize: `${o.size / PX_TO_CQW}cqw`,
    color: o.color,
    lineHeight: 1.18,
    letterSpacing: "-0.01em",
    whiteSpace: "pre-wrap",
    wordBreak: "keep-all",
    WebkitTextStrokeWidth: stroke ? `${(o.strokeWidth as number) / PX_TO_CQW}cqw` : "0px",
    WebkitTextStrokeColor: o.strokeColor || "#000",
    paintOrder: "stroke fill",
    background: o.bgColor || "transparent",
    padding: o.bgColor ? "0.12em 0.5em" : 0,
    borderRadius: o.bgColor ? "0.16em" : 0,
    textShadow,
  };
}

/** 9:16 stage that draws the background frame, center guide line, and text overlay. */
export function PreviewStage({
  bg,
  textStyle,
  text,
  secondColor,
  className,
  style,
}: {
  bg: string | null;
  textStyle: CSSProperties;
  text: string;
  /** If set, the first line uses textStyle.color and subsequent lines use this color (different top/bottom line colors). */
  secondColor?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ position: "relative", containerType: "size", overflow: "hidden", background: "#000", ...style }}
    >
      {bg && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${bg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: "7%",
          right: "7%",
          top: "50%",
          borderTop: "1px dashed rgba(255,255,255,.22)",
        }}
      />
      {secondColor ? (
        <p style={textStyle}>
          {(text || " ").split("\n").map((ln, i) => (
            <span key={i} style={{ display: "block", color: i === 0 ? undefined : secondColor }}>
              {ln || " "}
            </span>
          ))}
        </p>
      ) : (
        <p style={textStyle}>{text || " "}</p>
      )}
    </div>
  );
}

/** Fullscreen editor modal shell — header / body (preview) / bottom control panel. */
export function EditorShell({
  title,
  subtitle,
  saveLabel,
  saving,
  onSave,
  onClose,
  preview,
  panel,
}: {
  title: string;
  subtitle: string;
  saveLabel: string;
  saving?: boolean;
  onSave: () => void;
  onClose: () => void;
  preview: ReactNode;
  panel: ReactNode;
}) {
  const narrow = useIsNarrow();
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(4,7,13,.8)",
        backdropFilter: "blur(7px)",
        display: "flex",
      }}
    >
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 880,
          margin: "0 auto",
          background: "#0a0f1d",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0 80px rgba(0,0,0,.6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: narrow ? 10 : 14,
            padding: narrow ? "0 12px" : "0 18px",
            borderBottom: "1px solid #1c2740",
            flex: "none",
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              border: "1px solid #2a3650",
              background: "#141d30",
              color: "#cdd6ea",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</div>
            <div style={{ fontSize: 11.5, color: "#7c89a6", marginTop: 1 }}>{subtitle}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 9 }}>
            <button
              onClick={onClose}
              style={{
                background: "#161f33",
                border: "1px solid #2a3650",
                color: "#b6c0d6",
                fontWeight: 700,
                fontSize: 13.5,
                padding: "10px 16px",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                background: "#1d4ed8",
                border: "none",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13.5,
                padding: "10px 20px",
                borderRadius: 10,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : saveLabel}
            </button>
          </div>
        </div>

        {narrow ? (
          /* Mobile: everything below the header is one vertical scroll area */
          <div style={{ flex: 1, overflow: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 14, gap: 14 }}>
              {preview}
            </div>
            <div style={{ borderTop: "1px solid #1c2740", background: "#0c1322" }}>{panel}</div>
          </div>
        ) : (
          /* Desktop: preview (scrolling) + fixed bottom panel */
          <>
            <div
              style={{
                flex: 1,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                padding: 20,
                gap: 16,
              }}
            >
              {preview}
            </div>
            <div style={{ flex: "none", borderTop: "1px solid #1c2740", background: "#0c1322" }}>{panel}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Shared controls ─────────────────────────────────────────────

export function PreviewBox({ children }: { children: ReactNode }) {
  const narrow = useIsNarrow();
  return (
    <div
      style={{
        position: "relative",
        height: narrow ? "clamp(200px, 38vh, 320px)" : "clamp(300px, calc(100vh - 360px), 600px)",
        aspectRatio: "9 / 16",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,.55)",
        flex: "none",
        border: "1px solid #1d2942",
      }}
    >
      {children}
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>{children}</div>;
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 12, color: "#7c89a6", fontWeight: 700, whiteSpace: "nowrap" }}>{children}</span>
  );
}

export function Divider() {
  return <span style={{ width: 1, height: 24, background: "#243049", flex: "none" }} />;
}

export function NumValue({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 13, color: "#dfe6f2", fontWeight: 700, minWidth: 46, textAlign: "right" }}>
      {children}
    </span>
  );
}

export function ToggleButton({
  active,
  onClick,
  children,
  extraStyle,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  extraStyle?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 36,
        minWidth: 38,
        padding: "0 12px",
        borderRadius: 9,
        border: active ? "1px solid #3b82f6" : "1px solid #2a3650",
        background: active ? "#1e3a8a" : "#141d30",
        color: active ? "#fff" : "#cdd6ea",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 32,
        height: 32,
        border: "1px solid #2a3650",
        background: "none",
        borderRadius: 9,
        cursor: "pointer",
        padding: 2,
      }}
    />
  );
}

export function RangeInput({
  min,
  max,
  step = 1,
  value,
  onChange,
  width = 130,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  width?: number;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width }}
    />
  );
}

export function Swatches({ current, onPick }: { current: string; onPick: (c: string) => void }) {
  return (
    <>
      {SWATCHES.map((col) => (
        <button
          key={col}
          onClick={() => onPick(col)}
          title={col}
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: col,
            border: col.toLowerCase() === current.toLowerCase() ? "2.5px solid #3b82f6" : "2px solid rgba(255,255,255,.16)",
            cursor: "pointer",
            padding: 0,
            flex: "none",
          }}
        />
      ))}
    </>
  );
}

export const SELECT_STYLE: CSSProperties = {
  background: "#141d30",
  border: "1px solid #2a3650",
  color: "#e9eef7",
  fontSize: 13.5,
  fontWeight: 700,
  padding: "8px 10px",
  borderRadius: 9,
  cursor: "pointer",
};

export const PANEL_PAD: CSSProperties = {
  padding: "14px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
