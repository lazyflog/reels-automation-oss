"use client";

import { useState } from "react";
import { SubtitleOptions } from "@/lib/api";
import { FontFamily } from "@/components/CoverEditorModal";
import {
  EditorShell, PreviewStage, PreviewBox, buildTextStyle,
  Row, Label, Divider, NumValue, ToggleButton, ColorInput, RangeInput, Swatches,
  SELECT_STYLE, PANEL_PAD,
} from "@/components/editor/EditorKit";

const DEFAULT_SUB_FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf";

export interface SubtitleInitial {
  fontPath: string | null;
  bold: boolean;
  italic: boolean;
  fontSize: number;
  color: string;
  position: number;       // 1~10
  bgColor: string | null;
  strokeColor: string | null;
  strokeWidth: number;
  shadowColor: string | null;
  shadowOffset: number;
  shadowBlur: number;
}

// subtitle_position may be a legacy string (top/middle/bottom, etc.), so normalize to 1–10
export function normalizeSubPosition(raw: string | null): number {
  if (!raw) return 8;
  const n = parseInt(raw, 10);
  if (!Number.isNaN(n)) return Math.min(10, Math.max(1, n));
  const map: Record<string, number> = { top: 1, upper: 3, middle: 5, lower: 8, bottom: 10 };
  return map[raw] ?? 8;
}

export default function SubtitleEditorModal({
  fontList,
  fontFamilies,
  bgFrame,
  sampleText,
  initial,
  onClose,
  onSave,
}: {
  fontList: { name: string; path: string }[];
  fontFamilies: FontFamily[];
  bgFrame: string | null;
  sampleText: string;
  initial: SubtitleInitial;
  onClose: () => void;
  onSave: (opts: SubtitleOptions) => Promise<void>;
}) {
  const initFamily = fontFamilies.find((f) => f.regular === initial.fontPath || f.bold === initial.fontPath);

  const [text, setText] = useState(sampleText || "Your subtitles appear here");
  const [selectedPath, setSelectedPath] = useState(initial.fontPath || DEFAULT_SUB_FONT);
  const [bold, setBold] = useState(initFamily ? initFamily.bold === initial.fontPath : initial.bold);
  const [italic, setItalic] = useState(initial.italic);
  const [size, setSize] = useState(initial.fontSize);
  const [color, setColor] = useState(initial.color);
  const [position, setPosition] = useState<number>(initial.position);
  const [bg, setBg] = useState(!!initial.bgColor);
  const [bgColor, setBgColor] = useState(initial.bgColor || "#111827");
  const [border, setBorder] = useState((initial.strokeWidth ?? 0) > 0);
  const [strokeColor, setStrokeColor] = useState(initial.strokeColor || "#000000");
  const [strokeWidth, setStrokeWidth] = useState(initial.strokeWidth || 6);
  const [shadowOffset, setShadowOffset] = useState(initial.shadowOffset);
  const [shadowBlur, setShadowBlur] = useState(initial.shadowBlur);
  const [saving, setSaving] = useState(false);

  const family = fontFamilies.find((f) => f.regular === selectedPath || f.bold === selectedPath);
  const resolvedFont = family ? (bold ? family.bold : family.regular) : selectedPath;
  const displayName = fontList.find((f) => f.path === resolvedFont || f.path === selectedPath)?.name ?? family?.name ?? "";
  const topPct = 6 + ((position - 1) / 9) * 86;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        subtitle_color: color,
        subtitle_bg_color: bg ? bgColor : "",
        subtitle_font: resolvedFont,
        subtitle_font_size: size,
        subtitle_italic: italic,
        subtitle_position: String(position),
        subtitle_stroke_color: border ? strokeColor : "",
        subtitle_stroke_width: border ? strokeWidth : 0,
        subtitle_shadow_color: initial.shadowColor || "#000000",
        subtitle_shadow_offset: shadowOffset,
        subtitle_shadow_blur: shadowBlur,
      });
    } finally {
      setSaving(false);
    }
  };

  const textStyle = buildTextStyle({
    text,
    font: displayName || "Pretendard",
    size,
    color,
    bold,
    italic,
    topPct,
    strokeColor,
    strokeWidth: border ? strokeWidth : 0,
    shadow: true,
    shadowOffset,
    shadowBlur,
    bgColor: bg ? bgColor : null,
  });

  const preview = (
    <>
      <PreviewBox>
        <PreviewStage bg={bgFrame} textStyle={textStyle} text={text} style={{ width: "100%", height: "100%" }} />
      </PreviewBox>
      <span style={{ fontSize: 11.5, color: "#7c89a6" }}>
        ⓘ Subtitle text is for preview only · Saved styles apply from the next render
      </span>
    </>
  );

  const panel = (
    <div style={PANEL_PAD}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Preview text (not saved)"
        style={{
          width: "100%", background: "#101a2b", border: "1px solid #2a3650", borderRadius: 11,
          color: "#e9eef7", fontSize: 15, fontWeight: 600, padding: "11px 13px", outline: "none",
        }}
      />
      <Row>
        <Label>Color</Label>
        <Swatches current={color} onPick={setColor} />
        <ColorInput value={color} onChange={setColor} />
      </Row>
      <Row>
        <ToggleButton active={bold} onClick={() => setBold(!bold)} extraStyle={{ fontWeight: 800 }}>B</ToggleButton>
        <ToggleButton active={italic} onClick={() => setItalic(!italic)} extraStyle={{ fontStyle: "italic", fontFamily: "serif" }}>I</ToggleButton>
        <Divider />
        <Label>Font</Label>
        <select value={selectedPath} onChange={(e) => setSelectedPath(e.target.value)} style={SELECT_STYLE}>
          {fontList.length === 0 && <option value="">Default font</option>}
          {fontList.map((f) => (
            <option key={f.path} value={f.path}>{f.name}</option>
          ))}
        </select>
        <Divider />
        <Label>Size</Label>
        <RangeInput min={24} max={96} value={size} onChange={setSize} width={130} />
        <NumValue>{size}px</NumValue>
      </Row>
      <Row>
        <ToggleButton active={bg} onClick={() => setBg(!bg)}>Background</ToggleButton>
        <ColorInput value={bgColor} onChange={setBgColor} />
        <Divider />
        <ToggleButton active={border} onClick={() => setBorder(!border)}>Outline</ToggleButton>
        <ColorInput value={strokeColor} onChange={setStrokeColor} />
        <Label>Width</Label>
        <RangeInput min={0} max={20} value={strokeWidth} onChange={setStrokeWidth} width={90} />
        <NumValue>{strokeWidth}</NumValue>
      </Row>
      <Row>
        <Label>Shadow</Label>
        <Label>Offset</Label>
        <RangeInput min={0} max={12} value={shadowOffset} onChange={setShadowOffset} width={90} />
        <NumValue>{shadowOffset}</NumValue>
        <Label>Blur</Label>
        <RangeInput min={0} max={12} value={shadowBlur} onChange={setShadowBlur} width={90} />
        <NumValue>{shadowBlur}</NumValue>
        <Divider />
        <Label>Position</Label>
        <RangeInput min={1} max={10} value={position} onChange={setPosition} width={120} />
        <NumValue>{position} / 10</NumValue>
      </Row>
    </div>
  );

  return (
    <EditorShell
      title="Edit subtitles"
      subtitle="Instagram-style unified panel · Same controls as the cover editor"
      saveLabel="Save subtitles"
      saving={saving}
      onSave={handleSave}
      onClose={onClose}
      preview={preview}
      panel={panel}
    />
  );
}
