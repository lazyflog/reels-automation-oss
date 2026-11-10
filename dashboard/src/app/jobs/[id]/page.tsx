"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, Job, CoverOptions, SubtitleOptions } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { PreviewStage, buildTextStyle } from "@/components/editor/EditorKit";
import CoverEditorModal, { FontFamily, CoverInitial } from "@/components/CoverEditorModal";
import SubtitleEditorModal, { SubtitleInitial, normalizeSubPosition } from "@/components/SubtitleEditorModal";
import FontFaceLoader from "@/components/FontFaceLoader";

const DIRECT_URL = typeof window !== "undefined" ? window.location.origin : "";
const DEFAULT_COVER_FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf";

const COVER_POS_PCT: Record<string, number> = {
  top: 9, upper: 28, middle: 50, lower: 72, bottom: 91,
};

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  const [script, setScript] = useState({ hook: "", points: ["", "", ""], cta: "" });
  const [fullScriptText, setFullScriptText] = useState("");
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [targets, setTargets] = useState<string[]>(["instagram"]);

  // 표지 선택 state
  const [frames, setFrames] = useState<string[]>([]);
  const [frameTimes, setFrameTimes] = useState<number[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
  // 표지 스타일 (저장된 값 반영)
  const [fontList, setFontList] = useState<{ name: string; path: string }[]>([]);
  const [fontFamilies, setFontFamilies] = useState<FontFamily[]>([]);
  const [coverFont, setCoverFont] = useState(DEFAULT_COVER_FONT);
  const [coverBold, setCoverBold] = useState(true);
  const [coverFontSize, setCoverFontSize] = useState(72);
  const [coverTitleColor, setCoverTitleColor] = useState("#ffffff");
  const [coverTitleColor2, setCoverTitleColor2] = useState<string | null>(null);
  const [coverTitlePosition, setCoverTitlePosition] = useState("middle");
  const [coverItalic, setCoverItalic] = useState(false);
  const [coverStrokeColor, setCoverStrokeColor] = useState("#000000");
  const [coverStrokeWidth, setCoverStrokeWidth] = useState(0);

  // 편집 모달 / 토스트
  const [openEditor, setOpenEditor] = useState<"cover" | "sub" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  // TTS 검수 state
  const [approvingTts, setApprovingTts] = useState(false);
  const [regeneratingTts, setRegeneratingTts] = useState(false);

  const resolvedCoverFont = (() => {
    const fam = fontFamilies.find((f) => f.regular === coverFont || f.bold === coverFont);
    return fam ? (coverBold ? fam.bold : fam.regular) : coverFont;
  })();
  const coverFamilyName = fontFamilies.find((f) => f.regular === coverFont || f.bold === coverFont)?.name ?? "";

  const fetchJob = async () => {
    try {
      const data = await api.getJob(id);
      setJob(data);
      if (data.script) {
        setScript({
          hook: data.script.hook || "",
          points: data.script.points || ["", "", ""],
          cta: data.script.cta || "",
        });
        const full = data.script.full_text || [
          data.script.hook || "",
          ...(data.script.points || []),
          data.script.cta || "",
        ].filter(Boolean).join("\n");
        setFullScriptText(full);
      }
      if (data.caption) setCaption(data.caption);
      if (data.title) setTitle(data.title);
      if (data.upload_targets) setTargets(data.upload_targets);
      if (data.cover_font) setCoverFont(data.cover_font);
      if (typeof data.cover_font_size === "number") setCoverFontSize(data.cover_font_size);
      if (data.cover_title_color) setCoverTitleColor(data.cover_title_color);
      setCoverTitleColor2(data.cover_title_color2 ?? null);
      if (data.cover_title_position) setCoverTitlePosition(data.cover_title_position);
      if (typeof data.cover_italic === "boolean") setCoverItalic(data.cover_italic);
      if (data.cover_stroke_color) setCoverStrokeColor(data.cover_stroke_color);
      if (typeof data.cover_stroke_width === "number") setCoverStrokeWidth(data.cover_stroke_width);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [id]);

  useEffect(() => {
    api.listFonts()
      .then((res) => { setFontList(res.items || []); setFontFamilies(res.families || []); })
      .catch(() => { /* 폰트 목록 실패 시 기본 폰트 사용 */ });
  }, []);

  // 저장된 표지 폰트가 regular 변형이면 볼드 토글 해제
  useEffect(() => {
    if (!fontFamilies.length) return;
    const fam = fontFamilies.find((f) => f.regular === coverFont || f.bold === coverFont);
    if (fam) setCoverBold(fam.bold === coverFont);
  }, [fontFamilies, coverFont]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenEditor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const loadFrames = async () => {
    setLoadingFrames(true);
    try {
      const res = await api.getFrames(id);
      setFrames(res.frames);
      setFrameTimes(res.frame_times ?? []);
      if (selectedFrame === null && res.frames.length) setSelectedFrame(0);
    } catch (e) {
      alert(`프레임 로드 실패: ${e}`);
    } finally {
      setLoadingFrames(false);
    }
  };

  const openCoverEditor = async () => {
    setOpenEditor("cover");
    if (!frames.length) await loadFrames();
  };

  const handleSaveScript = async () => {
    setSaving(true);
    try {
      await api.patchJob(id, { script: { ...script, full_text: fullScriptText }, title });
      showToast("대본이 저장되었습니다");
      await fetchJob();
    } catch (e) {
      alert(`저장 실패: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCaption = async () => {
    setSaving(true);
    try {
      await api.patchJob(id, { caption });
      showToast("캡션이 저장되었습니다");
      await fetchJob();
    } catch (e) {
      alert(`저장 실패: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await api.approveJob(id, targets);
      showToast("승인되었습니다 · 업로드를 예약합니다");
      await fetchJob();
    } catch (e) {
      alert(`승인 실패: ${e}`);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("반려하시겠습니까?")) return;
    await api.rejectJob(id);
    await fetchJob();
  };

  const handleRetry = async () => {
    await api.retryJob(id);
    await fetchJob();
  };

  // ── 표지 편집 모달 콜백 ──
  const handleCoverSave = async (frameTime: number, opts: CoverOptions) => {
    try {
      await api.setCover(id, frameTime, opts);
      showToast("표지가 저장되었습니다");
      setOpenEditor(null);
      await fetchJob();
    } catch (e) {
      alert(`표지 저장 실패: ${e}`);
    }
  };

  const handleCoverServerPreview = async (frameTime: number, opts: CoverOptions) => {
    const blob = await api.previewCover(id, frameTime, opts);
    return URL.createObjectURL(blob);
  };

  // ── 자막 편집 모달 콜백 ──
  const handleSubtitleSave = async (opts: SubtitleOptions) => {
    try {
      await api.patchJob(id, opts);
      showToast("자막 스타일이 저장되었습니다 · 다음 렌더부터 적용");
      setOpenEditor(null);
      await fetchJob();
    } catch (e) {
      alert(`자막 저장 실패: ${e}`);
    }
  };

  const handleApproveTtsReview = async () => {
    setApprovingTts(true);
    try {
      await api.approveTtsReview(id);
      showToast("검수 완료 · 최종 렌더를 시작합니다");
      await fetchJob();
    } catch (e) {
      alert(`검수 승인 실패: ${e}`);
    } finally {
      setApprovingTts(false);
    }
  };

  const handleRegenerateTts = async () => {
    setRegeneratingTts(true);
    try {
      await api.patchJob(id, { script: { ...script, full_text: fullScriptText }, title });
      await api.regenerateTts(id);
      showToast("대본 수정 후 TTS 재생성을 시작합니다");
      await fetchJob();
    } catch (e) {
      alert(`TTS 재생성 실패: ${e}`);
    } finally {
      setRegeneratingTts(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;
  }
  if (!job) {
    return <div className="text-center text-gray-500 mt-20">작업을 찾을 수 없습니다.</div>;
  }

  const videoUrl = job.output_path ? `${DIRECT_URL}/api/jobs/${id}/download` : null;
  const downloadReady = ["review_pending", "approved", "uploading", "published", "awaiting_tts_review"].includes(job.status);
  const isTtsReview = job.status === "awaiting_tts_review";
  const isFinalReview = job.status === "review_pending";
  const canEditCover = ["watermarks_removed", "analyzed", "extracted", "awaiting_cover", "generating", "generated", "tts_processing", "tts_done", "awaiting_tts_review", "review_pending"].includes(job.status);

  // 표지 카드 라이브 썸네일
  const coverBg = selectedFrame !== null ? frames[selectedFrame] : frames[0] ?? null;
  const coverThumbStyle = buildTextStyle({
    text: title, font: coverFamilyName || "Pretendard", size: coverFontSize, color: coverTitleColor,
    bold: coverBold, italic: coverItalic, topPct: COVER_POS_PCT[coverTitlePosition] ?? 50,
    strokeColor: coverStrokeColor, strokeWidth: coverStrokeWidth, shadow: true,
  });

  // 자막 카드 라이브 썸네일 (job의 저장값 기반)
  const subFamilyName = fontFamilies.find((f) => f.regular === job.subtitle_font || f.bold === job.subtitle_font)?.name ?? "";
  const subSample = job.script?.hook?.slice(0, 16) || "여기에 자막이 표시됩니다";
  const subBg = frames[3] ?? frames[0] ?? null;
  const subThumbStyle = buildTextStyle({
    text: subSample, font: subFamilyName || "Pretendard",
    size: job.subtitle_font_size ?? 64, color: job.subtitle_color || "#ffffff",
    bold: true, italic: !!job.subtitle_italic,
    topPct: 6 + ((normalizeSubPosition(job.subtitle_position) - 1) / 9) * 86,
    strokeColor: job.subtitle_stroke_color, strokeWidth: job.subtitle_stroke_width ?? 0,
    shadow: true, shadowOffset: job.subtitle_shadow_offset ?? 3, shadowBlur: job.subtitle_shadow_blur ?? 2,
    bgColor: job.subtitle_bg_color,
  });

  const card: React.CSSProperties = { background: "#0f1626", border: "1px solid #1d2942", borderRadius: 16, padding: 16 };
  const setBadge = (
    <span style={{ fontSize: 11, color: "#34d399", background: "rgba(52,211,153,.12)", border: "1px solid rgba(52,211,153,.28)", borderRadius: 20, padding: "3px 9px", fontWeight: 700 }}>설정됨</span>
  );

  const coverInitial: CoverInitial = {
    title, fontPath: coverFont, bold: coverBold, fontSize: coverFontSize, color: coverTitleColor, color2: coverTitleColor2,
    position: coverTitlePosition, italic: coverItalic, strokeColor: coverStrokeColor, strokeWidth: coverStrokeWidth,
  };
  const subtitleInitial: SubtitleInitial = {
    fontPath: job.subtitle_font, bold: true, italic: !!job.subtitle_italic,
    fontSize: job.subtitle_font_size ?? 64, color: job.subtitle_color || "#ffffff",
    position: normalizeSubPosition(job.subtitle_position),
    bgColor: job.subtitle_bg_color, strokeColor: job.subtitle_stroke_color, strokeWidth: job.subtitle_stroke_width ?? 0,
    shadowColor: job.subtitle_shadow_color, shadowOffset: job.subtitle_shadow_offset ?? 3, shadowBlur: job.subtitle_shadow_blur ?? 2,
  };

  return (
    <div className="-m-4 sm:-m-6" style={{ background: "radial-gradient(1200px 600px at 50% -10%,#101a30 0%,#0a0e16 60%)", minHeight: "calc(100% + 3rem)" }}>
      <FontFaceLoader families={fontFamilies} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">

        {/* 브레드크럼 + 헤더 */}
        <div className="flex items-center gap-2 text-xs" style={{ color: "#6b7a96" }}>
          <button onClick={() => router.back()} className="hover:text-white">← 작업</button>
          <span style={{ color: "#3a465f" }}>/</span>
          <span style={{ color: "#cdd6ea" }}>#{id.slice(0, 8)}</span>
        </div>

        <div className="flex items-start gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight truncate" style={{ letterSpacing: "-0.03em" }}>
              {job.title || (job.source_urls?.length > 1 ? `${job.source_urls[0]} 외 ${job.source_urls.length - 1}개` : job.source_url)}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={job.status} />
              {job.source_urls?.[0] && (
                <span className="text-xs truncate" style={{ color: "#6b7a96", maxWidth: 360 }}>🔗 {job.source_urls[0]}</span>
              )}
            </div>
          </div>
          {downloadReady && videoUrl && (
            <a
              href={api.downloadJobUrl(job.id)}
              download={`${job.id}.mp4`}
              className="ml-auto text-sm px-4 py-2 rounded-lg font-bold text-white"
              style={{ background: "#16633a" }}
            >
              mp4 다운로드
            </a>
          )}
        </div>

        {/* 지금 할 일 배너 + 단계 */}
        {(isTtsReview || isFinalReview) && (
          <div className="flex items-center gap-3 flex-wrap" style={{ background: "linear-gradient(90deg,rgba(245,180,0,.10),rgba(245,180,0,0))", border: "1px solid rgba(245,180,0,.22)", borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245,180,0,.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flex: "none" }}>✓</div>
            <div className="min-w-0" style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: "#fbe3a1" }}>
                {isTtsReview ? "지금 할 일 — 검수 1 · 자막/음성 확인" : "지금 할 일 — 검수 2 · 최종 영상 승인"}
              </div>
              <div style={{ fontSize: 12.5, color: "#9aa6c0", marginTop: 2 }}>
                {isTtsReview ? "표지와 자막을 확인하고 승인하면 1080p 최종 렌더로 넘어갑니다." : "최종 영상을 확인하고 업로드 플랫폼을 선택해 승인하세요."}
              </div>
            </div>
            <Steps active={isTtsReview ? 1 : 2} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

          {/* 좌측: 프리뷰 + 분석 + 상태 */}
          <div className="space-y-4">
            <div style={card}>
              <div className="flex justify-between items-center mb-3">
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#9aa6c0" }}>
                  {isTtsReview ? "540p 프리뷰" : "영상 미리보기"}
                </span>
                <span style={{ fontSize: 11, color: "#6b7a96", background: "#111a2b", border: "1px solid #21304c", borderRadius: 6, padding: "3px 7px" }}>
                  {isTtsReview ? "검수용 저화질" : "9:16"}
                </span>
              </div>
              {videoUrl ? (
                <video src={videoUrl} controls className="rounded-xl w-full" style={{ aspectRatio: "9/16", background: "#000", border: "1px solid #1d2942" }} />
              ) : (
                <div className="flex items-center justify-center rounded-xl text-sm w-full" style={{ aspectRatio: "9/16", background: "#0b1220", color: "#5d6b88", border: "1px solid #1d2942" }}>
                  {["editing", "analyzing", "removing_watermarks"].includes(job.status) ? "처리 중..." : "영상 없음"}
                </div>
              )}
            </div>

            {job.analysis_result && (
              <div style={card}>
                <h2 className="text-sm font-medium mb-3" style={{ color: "#9aa6c0" }}>AI 분석 결과</h2>
                <div className="space-y-2 text-sm">
                  {job.analysis_result.product_name && (
                    <div><span style={{ color: "#6b7a96" }}>상품명: </span><span className="text-white">{job.analysis_result.product_name}</span></div>
                  )}
                  {job.analysis_result.category && (
                    <div><span style={{ color: "#6b7a96" }}>카테고리: </span><span className="text-gray-300 text-xs">{job.analysis_result.category}</span></div>
                  )}
                  {job.analysis_result.key_features && job.analysis_result.key_features.length > 0 && (
                    <div>
                      <span className="block mb-1" style={{ color: "#6b7a96" }}>핵심 특징:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {job.analysis_result.key_features.map((f, i) => <li key={i} className="text-gray-300 text-xs">{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {job.analysis_result.target_audience && (
                    <div><span style={{ color: "#6b7a96" }}>타겟: </span><span className="text-gray-300 text-xs">{job.analysis_result.target_audience}</span></div>
                  )}
                  {job.analysis_result.pain_points && job.analysis_result.pain_points.length > 0 && (
                    <div>
                      <span className="block mb-1" style={{ color: "#6b7a96" }}>해결하는 고민:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {job.analysis_result.pain_points.map((p, i) => <li key={i} className="text-gray-300 text-xs">{p}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={card}>
              <h2 className="text-sm font-medium mb-3" style={{ color: "#9aa6c0" }}>처리 상태</h2>
              <div className="space-y-2 text-sm">
                {[
                  { key: "pending", label: "대기" },
                  { key: "extracted", label: "수집 완료" },
                  { key: "analyzed", label: "AI 분석 완료" },
                  { key: "watermarks_removed", label: "워터마크 제거 완료" },
                  { key: "generated", label: "대본 생성 완료" },
                  { key: "tts_done", label: "TTS 완료" },
                  { key: "awaiting_tts_review", label: "자막/음성 검수 대기" },
                  { key: "review_pending", label: "최종 검수 대기" },
                  { key: "published", label: "게시 완료" },
                ].map((step) => (
                  <div key={step.key} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: job.status === step.key ? "#3b82f6" : "#26324c" }} />
                    <span style={{ color: job.status === step.key ? "#fff" : "#5d6b88" }}>{step.label}</span>
                  </div>
                ))}
              </div>
              {job.error_message && (
                <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: "rgba(239,68,68,.12)", color: "#f87171" }}>{job.error_message}</div>
              )}
              {job.status === "failed" && (
                <button onClick={handleRetry} className="mt-3 text-xs px-3 py-1.5 rounded-lg" style={{ background: "#172238", color: "#cdd6ea" }}>재시도</button>
              )}
            </div>
          </div>

          {/* 우측: 편집 카드들 */}
          <div className="space-y-4">

            {/* 표지 카드 */}
            {canEditCover && (
              <div style={card}>
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>표지</span>
                  {job.cover_frame_time && setBadge}
                </div>
                <div className="flex gap-4 items-center">
                  <div style={{ position: "relative", width: 78, height: 139, borderRadius: 10, overflow: "hidden", flex: "none", border: "1px solid #2a3650" }}>
                    <PreviewStage bg={coverBg} textStyle={coverThumbStyle} text={title} secondColor={coverTitleColor2 || null} style={{ width: "100%", height: "100%" }} />
                  </div>
                  <div className="min-w-0" style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: "#9aa6c0", lineHeight: 1.7 }}>
                      {selectedFrame !== null ? <>프레임 <b style={{ color: "#cdd6ea" }}>#{selectedFrame + 1}</b> · </> : null}
                      {coverFamilyName || "기본 폰트"}<br />제목 {coverTitleColor} / 테두리 {coverStrokeWidth}
                    </div>
                    <button onClick={openCoverEditor} className="mt-3 w-full text-white font-bold rounded-lg" style={{ background: "#1d4ed8", fontSize: 14, padding: 11 }}>
                      표지 편집 · 실시간 미리보기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 자막 카드 */}
            <div style={card}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>자막 스타일</span>
                {job.subtitle_color && setBadge}
              </div>
              <div className="flex gap-4 items-center">
                <div style={{ position: "relative", width: 78, height: 139, borderRadius: 10, overflow: "hidden", flex: "none", border: "1px solid #2a3650" }}>
                  <PreviewStage bg={subBg} textStyle={subThumbStyle} text={subSample} style={{ width: "100%", height: "100%" }} />
                </div>
                <div className="min-w-0" style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: "#9aa6c0", lineHeight: 1.7 }}>
                    {subFamilyName || "기본 폰트"} · {job.subtitle_color || "흰색"}<br />
                    테두리 {job.subtitle_stroke_width ?? 0} · 위치 {normalizeSubPosition(job.subtitle_position)}/10
                  </div>
                  <button onClick={() => setOpenEditor("sub")} className="mt-3 w-full font-bold rounded-lg" style={{ background: "#172238", border: "1px solid #2a3650", color: "#e9eef7", fontSize: 14, padding: 11 }}>
                    자막 편집 · 통합 패널
                  </button>
                </div>
              </div>
            </div>

            {/* 대본 편집 */}
            <div style={card} className="space-y-4">
              <h2 className="text-sm font-medium" style={{ color: "#9aa6c0" }}>대본 편집</h2>
              <div>
                <label className="text-xs block mb-1" style={{ color: "#6b7a96" }}>제목 (릴스 제목)</label>
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="AI가 제안한 제목 또는 직접 입력"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: "#0b1220", border: "1px solid #1d2942", color: "#e9eef7" }}
                />
              </div>
              {(script.hook || script.points.some(Boolean) || script.cta) && (
                <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(255,255,255,.03)" }}>
                  <p className="text-xs mb-2" style={{ color: "#6b7a96" }}>대본 구조 (읽기 전용)</p>
                  {script.hook && <div className="text-xs"><span style={{ color: "#6b7a96" }}>Hook: </span><span className="text-gray-300">{script.hook}</span></div>}
                  {script.points.map((point, i) => point ? <div key={i} className="text-xs"><span style={{ color: "#6b7a96" }}>포인트{i + 1}: </span><span className="text-gray-300">{point}</span></div> : null)}
                  {script.cta && <div className="text-xs"><span style={{ color: "#6b7a96" }}>CTA: </span><span className="text-gray-300">{script.cta}</span></div>}
                </div>
              )}
              <div>
                <label className="text-xs block mb-1" style={{ color: "#6b7a96" }}>전체 대본 편집 (저장 시 TTS에 우선 적용)</label>
                <textarea
                  value={fullScriptText} onChange={(e) => setFullScriptText(e.target.value)} rows={8}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none font-mono"
                  style={{ background: "#0b1220", border: "1px solid #1d2942", color: "#e9eef7" }}
                />
              </div>
              <button onClick={handleSaveScript} disabled={saving} className="w-full text-white px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#172238", border: "1px solid #2a3650", opacity: saving ? 0.6 : 1 }}>
                {saving ? "저장 중..." : "대본 저장"}
              </button>
            </div>

            {/* 캡션 편집 */}
            <div style={card} className="space-y-4">
              <h2 className="text-sm font-medium" style={{ color: "#9aa6c0" }}>캡션 편집</h2>
              <textarea
                value={caption} onChange={(e) => setCaption(e.target.value)} rows={4}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                style={{ background: "#0b1220", border: "1px solid #1d2942", color: "#e9eef7" }}
              />
              <button onClick={handleSaveCaption} disabled={saving} className="w-full text-white px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#172238", border: "1px solid #2a3650", opacity: saving ? 0.6 : 1 }}>
                {saving ? "저장 중..." : "캡션 저장"}
              </button>
            </div>

            {/* 검수 1: TTS 검수 */}
            {isTtsReview && (
              <div style={{ ...card, background: "rgba(245,180,0,.06)", borderColor: "rgba(245,180,0,.22)" }} className="space-y-3">
                <h2 className="text-sm font-medium" style={{ color: "#f5b400" }}>자막/음성 검수</h2>
                <p className="text-xs" style={{ color: "#9aa6c0" }}>프리뷰에서 자막과 음성을 확인하세요. 대본을 수정하면 TTS를 재생성할 수 있습니다.</p>
                <div className="flex gap-3">
                  <button onClick={handleApproveTtsReview} disabled={approvingTts} className="flex-1 text-white px-4 py-3 rounded-xl text-sm font-extrabold" style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)", opacity: approvingTts ? 0.6 : 1 }}>
                    {approvingTts ? "처리 중..." : "승인 → 1080p 최종 렌더"}
                  </button>
                  <button onClick={handleRegenerateTts} disabled={regeneratingTts} className="px-4 py-3 rounded-xl text-sm font-bold" style={{ background: "#161f33", border: "1px solid #2a3650", color: "#b6c0d6", opacity: regeneratingTts ? 0.6 : 1 }}>
                    {regeneratingTts ? "처리 중..." : "수정 후 재생성"}
                  </button>
                </div>
              </div>
            )}

            {/* 검수 2: 최종 승인 */}
            {isFinalReview && (
              <div style={card} className="space-y-4">
                <h2 className="text-sm font-medium" style={{ color: "#9aa6c0" }}>업로드 플랫폼 선택</h2>
                <div className="flex gap-4">
                  {["instagram"].map((platform) => (
                    <label key={platform} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox" checked={targets.includes(platform)}
                        onChange={(e) => setTargets((t) => e.target.checked ? [...t, platform] : t.filter((x) => x !== platform))}
                        className="rounded"
                      />
                      <span className="text-sm capitalize">{platform}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={handleApprove} disabled={approving || targets.length === 0} className="flex-1 text-white px-4 py-3 rounded-xl text-sm font-extrabold" style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)", opacity: approving || targets.length === 0 ? 0.6 : 1 }}>
                    {approving ? "처리 중..." : "승인 & 업로드"}
                  </button>
                  <button onClick={handleReject} className="px-5 py-3 rounded-xl text-sm font-bold" style={{ background: "#161f33", border: "1px solid #2a3650", color: "#f87171" }}>반려</button>
                </div>
              </div>
            )}

            {/* 품질 평가 */}
            {job.eval_scores && (
              <div style={card} className="space-y-3">
                <h2 className="text-sm font-medium" style={{ color: "#9aa6c0" }}>품질 평가</h2>
                {job.eval_scores.script && (
                  <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,.03)" }}>
                    <p className="text-xs mb-2" style={{ color: "#6b7a96" }}>대본 평가</p>
                    <div className="flex gap-4 flex-wrap text-sm">
                      <div><span style={{ color: "#6b7a96" }}>종합: </span><span className={job.eval_scores.script.overall_score >= 7 ? "text-green-400" : job.eval_scores.script.overall_score >= 5 ? "text-yellow-400" : "text-red-400"}>{job.eval_scores.script.overall_score}/10</span></div>
                      <div><span style={{ color: "#6b7a96" }}>훅: </span><span className="text-gray-300">{job.eval_scores.script.hook_quality}/10</span></div>
                      <div><span style={{ color: "#6b7a96" }}>흐름: </span><span className="text-gray-300">{job.eval_scores.script.coherence}/10</span></div>
                      <div><span style={{ color: "#6b7a96" }}>페르소나: </span><span className="text-gray-300">{job.eval_scores.script.persona_match}/10</span></div>
                      <div><span style={{ color: "#6b7a96" }}>예상 시간: </span><span className="text-gray-300">{job.eval_scores.script.timing_estimate}초</span></div>
                    </div>
                  </div>
                )}
                {job.eval_scores.tts && (
                  <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,.03)" }}>
                    <p className="text-xs mb-2" style={{ color: "#6b7a96" }}>TTS 길이</p>
                    <div className="flex gap-4 flex-wrap text-sm">
                      <div><span style={{ color: "#6b7a96" }}>길이: </span><span className="text-gray-300">{job.eval_scores.tts.duration}초</span></div>
                      <div><span style={{ color: "#6b7a96" }}>한도: </span><span className="text-gray-300">{job.eval_scores.tts.limit}초</span></div>
                      <div><span style={{ color: "#6b7a96" }}>초과: </span><span className={job.eval_scores.tts.over_by > 0 ? "text-red-400" : "text-gray-300"}>{job.eval_scores.tts.over_by > 0 ? `+${job.eval_scores.tts.over_by}초` : "없음"}</span></div>
                      <div><span style={{ color: "#6b7a96" }}>준수: </span><span className={job.eval_scores.tts.compliance ? "text-green-400" : "text-red-400"}>{job.eval_scores.tts.compliance ? "정상" : "초과/미달"}</span></div>
                    </div>
                  </div>
                )}
                {job.eval_scores.video && (
                  <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,.03)" }}>
                    <p className="text-xs mb-2" style={{ color: "#6b7a96" }}>영상 품질</p>
                    <div className="flex gap-4 flex-wrap text-sm">
                      <div><span style={{ color: "#6b7a96" }}>길이: </span><span className="text-gray-300">{job.eval_scores.video.actual_duration}초</span></div>
                      <div><span style={{ color: "#6b7a96" }}>검은화면: </span><span className={job.eval_scores.video.has_black_frames ? "text-red-400" : "text-green-400"}>{job.eval_scores.video.has_black_frames ? "감지됨" : "없음"}</span></div>
                      <div><span style={{ color: "#6b7a96" }}>싱크: </span><span className={job.eval_scores.video.audio_video_sync ? "text-green-400" : "text-red-400"}>{job.eval_scores.video.audio_video_sync ? "정상" : "불일치"}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 게시 결과 */}
            {job.instagram_post_id && (
              <div style={card} className="space-y-2">
                <h2 className="text-sm font-medium" style={{ color: "#9aa6c0" }}>게시 결과</h2>
                {job.instagram_post_id && <p className="text-sm"><span style={{ color: "#6b7a96" }}>Instagram:</span> <span className="text-green-400">{job.instagram_post_id}</span></p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 표지 편집 모달 */}
      {openEditor === "cover" && (
        <CoverEditorModal
          frames={frames}
          frameTimes={frameTimes}
          frameIndex={selectedFrame}
          onFrameIndexChange={setSelectedFrame}
          loadingFrames={loadingFrames}
          fontList={fontList}
          fontFamilies={fontFamilies}
          initial={coverInitial}
          onLoadFrames={loadFrames}
          onClose={() => setOpenEditor(null)}
          onSave={handleCoverSave}
          onServerPreview={handleCoverServerPreview}
        />
      )}

      {/* 자막 편집 모달 */}
      {openEditor === "sub" && (
        <SubtitleEditorModal
          fontList={fontList}
          fontFamilies={fontFamilies}
          bgFrame={subBg}
          sampleText={subSample}
          initial={subtitleInitial}
          onClose={() => setOpenEditor(null)}
          onSave={handleSubtitleSave}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 30, transform: "translateX(-50%)", zIndex: 200, background: "#0d1424", border: "1px solid #2a3650", color: "#eaf0fb", fontSize: 13.5, fontWeight: 700, padding: "13px 20px", borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,.5)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#22c55e", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#04210f" }}>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}

function Steps({ active }: { active: 1 | 2 }) {
  const dot = (n: number, label: string) => {
    const on = active === n;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: on ? 700 : 600, color: on ? "#f5b400" : "#5d6b88" }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: on ? "#f5b400" : "transparent", color: on ? "#1a1303" : "#5d6b88", border: on ? "none" : "1px solid #3a465f", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{n}</span>
        {label}
      </span>
    );
  };
  return (
    <div className="flex items-center gap-2" style={{ flex: "none" }}>
      {dot(1, "자막·음성")}
      <span style={{ width: 22, height: 1, background: "#2a3650" }} />
      {dot(2, "최종 승인")}
    </div>
  );
}
