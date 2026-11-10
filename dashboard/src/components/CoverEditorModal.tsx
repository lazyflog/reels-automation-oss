"use client";

import { useState } from "react";
import { CoverOptions } from "@/lib/api";
import {
  EditorShell, PreviewStage, PreviewBox, buildTextStyle,
  Row, Label, Divider, NumValue, ToggleButton, ColorInput, RangeInput, Swatches,
  SELECT_STYLE, PANEL_PAD,
} from "@/components/editor/EditorKit";

export interface FontFamily {
  name: string;
  regular: string;
  bold: string;
}

const DEFAULT_COVER_FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf";

const POSITIONS = [
  { label: "최상단", value: "top", pct: 9 },
  { label: "상단", value: "upper", pct: 28 },
  { label: "중단", value: "middle", pct: 50 },
  { label: "하단", value: "lower", pct: 72 },
  { label: "최하단", value: "bottom", pct: 91 },
] as const;

export interface CoverInitial {
  title: string;
  fontPath: string;
  bold: boolean;
  fontSize: number;
  color: string;
  color2: string | null;
  position: string;
  italic: boolean;
  strokeColor: string;
  strokeWidth: number;
}

export default function CoverEditorModal({
  frames,
  frameTimes,
  frameIndex,
  onFrameIndexChange,
  loadingFrames,
  fontList,
  fontFamilies,
  initial,
  onLoadFrames,
  onClose,
  onSave,
  onServerPreview,
}: {
  frames: string[];
  frameTimes: number[];
  frameIndex: number | null;
  onFrameIndexChange: (i: number) => void;
  loadingFrames: boolean;
  fontList: { name: string; path: string }[];
  fontFamilies: FontFamily[];
  initial: CoverInitial;
  onLoadFrames: () => void;
  onClose: () => void;
  onSave: (frameTime: number, opts: CoverOptions) => Promise<void>;
  onServerPreview: (frameTime: number, opts: CoverOptions) => Promise<string>;
}) {
  const initFamily = fontFamilies.find((f) => f.regular === initial.fontPath || f.bold === initial.fontPath);

  const [title, setTitle] = useState(initial.title);
  const [selectedPath, setSelectedPath] = useState(initial.fontPath || DEFAULT_COVER_FONT);
  const [bold, setBold] = useState(initFamily ? initFamily.bold === initial.fontPath : initial.bold);
  const [italic, setItalic] = useState(initial.italic);
  const [size, setSize] = useState(initial.fontSize);
  const [color, setColor] = useState(initial.color);
  const [twoColor, setTwoColor] = useState(!!initial.color2);
  const [color2, setColor2] = useState(initial.color2 || "#f5b400");
  const [position, setPosition] = useState(initial.position);
  const [border, setBorder] = useState((initial.strokeWidth ?? 0) > 0);
  const [strokeColor, setStrokeColor] = useState(initial.strokeColor || "#000000");
  const [strokeWidth, setStrokeWidth] = useState(initial.strokeWidth || 6);
  const [shadow, setShadow] = useState(true);

  const [saving, setSaving] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(false);

  const topPct = POSITIONS.find((p) => p.value === position)?.pct ?? 50;
  const family = fontFamilies.find((f) => f.regular === selectedPath || f.bold === selectedPath);
  const resolvedFont = family ? (bold ? family.bold : family.regular) : selectedPath;
  const displayName = fontList.find((f) => f.path === resolvedFont || f.path === selectedPath)?.name ?? family?.name ?? "";

  const frameTimeFor = (i: number) => frameTimes[i] ?? 0.5 + i * 3;

  const buildOpts = (): CoverOptions => ({
    cover_title: title || undefined,
    cover_font: resolvedFont,
    cover_font_size: size,
    cover_title_color: color,
    cover_title_color2: twoColor ? color2 : "",  // 빈 문자열 → 단일색 해제
    cover_title_position: position,
    cover_italic: italic,
    cover_stroke_color: border ? strokeColor : null,
    cover_stroke_width: border ? strokeWidth : 0,
  });

  const handleSave = async () => {
    if (frameIndex === null) {
      alert("표지로 쓸 프레임을 먼저 선택하세요.");
      return;
    }
    setSaving(true);
    try {
      await onSave(frameTimeFor(frameIndex), buildOpts());
    } finally {
      setSaving(false);
    }
  };

  const handleServerPreview = async () => {
    if (frameIndex === null) {
      alert("프레임을 먼저 선택하세요.");
      return;
    }
    setServerLoading(true);
    try {
      const url = await onServerPreview(frameTimeFor(frameIndex), buildOpts());
      setServerUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      alert(`정확한 미리보기 실패: ${e}`);
    } finally {
      setServerLoading(false);
    }
  };

  const textStyle = buildTextStyle({
    text: title,
    font: displayName || "Pretendard",
    size,
    color,
    bold,
    italic,
    topPct,
    strokeColor,
    strokeWidth: border ? strokeWidth : 0,
    shadow,
  });

  const bg = frameIndex !== null ? frames[frameIndex] : frames[0] ?? null;

  const preview = (
    <>
      <PreviewBox>
        <PreviewStage bg={bg} textStyle={textStyle} text={title} secondColor={twoColor ? color2 : null} style={{ width: "100%", height: "100%" }} />
      </PreviewBox>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <button
          onClick={handleServerPreview}
          disabled={serverLoading}
          style={{
            background: "#141d30", border: "1px solid #2a3650", color: "#cdd6ea",
            fontWeight: 700, fontSize: 12.5, padding: "9px 14px", borderRadius: 9, cursor: "pointer",
          }}
        >
          {serverLoading ? "렌더 중..." : "정확한 렌더로 확인"}
        </button>
        {serverUrl && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#7c89a6" }}>실제 렌더</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={serverUrl}
              alt="실제 렌더 미리보기"
              style={{ width: 90, aspectRatio: "9/16", objectFit: "cover", borderRadius: 8, border: "1px solid #2a3650" }}
            />
          </div>
        )}
      </div>
    </>
  );

  const panel = (
    <>
      {/* 프레임 스트립 */}
      <div
        style={{
          padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: "1px solid #141e30",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "none" }}>
          <span style={{ fontSize: 12.5, fontWeight: 800 }}>표지 프레임</span>
          <span style={{ fontSize: 11, color: "#7c89a6" }}>영상에서 선택</span>
        </div>
        <div style={{ display: "flex", gap: 9, overflowX: "auto", padding: "2px 0", flex: 1 }}>
          {frames.map((f, i) => (
            <button
              key={i}
              onClick={() => onFrameIndexChange(i)}
              style={{
                position: "relative", width: 62, height: 110, borderRadius: 9, overflow: "hidden",
                border: i === frameIndex ? "2.5px solid #3b82f6" : "2px solid #2a3650",
                padding: 0, cursor: "pointer", flex: "none",
                backgroundImage: `url(${f})`, backgroundSize: "cover", backgroundPosition: "center",
              }}
            >
              {i === frameIndex && (
                <span
                  style={{
                    position: "absolute", top: 4, left: 4, width: 16, height: 16, borderRadius: "50%",
                    background: "#3b82f6", color: "#fff", fontSize: 10, display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onLoadFrames}
          disabled={loadingFrames}
          style={{
            flex: "none", marginLeft: "auto", background: "#141d30", border: "1px solid #2a3650",
            color: "#cdd6ea", fontWeight: 700, fontSize: 12.5, padding: "9px 13px", borderRadius: 9,
            cursor: "pointer", opacity: loadingFrames ? 0.6 : 1,
          }}
        >
          {loadingFrames ? "로딩 중..." : frames.length ? "다시 불러오기" : "프레임 불러오기"}
        </button>
      </div>

      {/* 컨트롤 */}
      <div style={PANEL_PAD}>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={2}
          placeholder="표지 제목 (줄바꿈 Enter로 윗줄/아랫줄 구분)"
          style={{
            width: "100%", background: "#101a2b", border: "1px solid #2a3650", borderRadius: 11,
            color: "#e9eef7", fontSize: 15, fontWeight: 600, padding: "11px 13px", outline: "none",
            lineHeight: 1.4, resize: "none",
          }}
        />
        <Row>
          <Label>{twoColor ? "윗줄" : "색상"}</Label>
          <Swatches current={color} onPick={setColor} />
          <ColorInput value={color} onChange={setColor} />
          <Divider />
          <ToggleButton active={twoColor} onClick={() => setTwoColor(!twoColor)}>줄별 색</ToggleButton>
        </Row>
        {twoColor && (
          <Row>
            <Label>아랫줄</Label>
            <Swatches current={color2} onPick={setColor2} />
            <ColorInput value={color2} onChange={setColor2} />
            <span style={{ fontSize: 11, color: "#7c89a6" }}>Enter로 나눈 2번째 줄에 적용</span>
          </Row>
        )}
        <Row>
          <ToggleButton active={bold} onClick={() => setBold(!bold)} extraStyle={{ fontWeight: 800 }}>B</ToggleButton>
          <ToggleButton active={italic} onClick={() => setItalic(!italic)} extraStyle={{ fontStyle: "italic", fontFamily: "serif" }}>I</ToggleButton>
          <Divider />
          <Label>글꼴</Label>
          <select value={selectedPath} onChange={(e) => setSelectedPath(e.target.value)} style={SELECT_STYLE}>
            {fontList.length === 0 && <option value="">기본 폰트</option>}
            {fontList.map((f) => (
              <option key={f.path} value={f.path}>{f.name}</option>
            ))}
          </select>
          <Divider />
          <Label>크기</Label>
          <RangeInput min={40} max={160} value={size} onChange={setSize} width={140} />
          <NumValue>{size}px</NumValue>
        </Row>
        <Row>
          <ToggleButton active={border} onClick={() => setBorder(!border)}>테두리</ToggleButton>
          <ColorInput value={strokeColor} onChange={setStrokeColor} />
          <Label>두께</Label>
          <RangeInput min={0} max={24} value={strokeWidth} onChange={setStrokeWidth} width={100} />
          <NumValue>{strokeWidth}</NumValue>
          <Divider />
          <ToggleButton active={shadow} onClick={() => setShadow(!shadow)}>그림자</ToggleButton>
        </Row>
        <Row>
          <Label>위치</Label>
          {POSITIONS.map((p) => (
            <ToggleButton key={p.value} active={position === p.value} onClick={() => setPosition(p.value)}>
              {p.label}
            </ToggleButton>
          ))}
        </Row>
      </div>
    </>
  );

  return (
    <EditorShell
      title="표지 편집"
      subtitle="1080×1920 · 바꾸면 바로 미리보기에 반영"
      saveLabel="표지 저장"
      saving={saving}
      onSave={handleSave}
      onClose={onClose}
      preview={preview}
      panel={panel}
    />
  );
}
