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

  // Cover selection state
  const [frames, setFrames] = useState<string[]>([]);
  const [frameTimes, setFrameTimes] = useState<number[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
  // Cover style (reflects saved values)
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

  // Editor modals / toast
  const [openEditor, setOpenEditor] = useState<"cover" | "sub" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  // TTS review state
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
      .catch(() => { /* Use default font if font list fails */ });
  }, []);

  // Turn off bold toggle if the saved cover font is a regular variant
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
      alert(`Failed to load frames: ${e}`);
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
      showToast("Script saved");
      await fetchJob();
    } catch (e) {
      alert(`Save failed: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCaption = async () => {
    setSaving(true);
    try {
      await api.patchJob(id, { caption });
      showToast("Caption saved");
      await fetchJob();
    } catch (e) {
      alert(`Save failed: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await api.approveJob(id, targets);
      showToast("Approved · Upload scheduled");
      await fetchJob();
    } catch (e) {
      alert(`Approval failed: ${e}`);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Reject this job?")) return;
    await api.rejectJob(id);
    await fetchJob();
  };

  const handleRetry = async () => {
    await api.retryJob(id);
    await fetchJob();
  };

  // ── Cover editor modal callbacks ──
  const handleCoverSave = async (frameTime: number, opts: CoverOptions) => {
    try {
      await api.setCover(id, frameTime, opts);
      showToast("Cover saved");
      setOpenEditor(null);
      await fetchJob();
    } catch (e) {
      alert(`Failed to save cover: ${e}`);
    }
  };

  const handleCoverServerPreview = async (frameTime: number, opts: CoverOptions) => {
    const blob = await api.previewCover(id, frameTime, opts);
    return URL.createObjectURL(blob);
  };

  // ── Subtitle editor modal callbacks ──
  const handleSubtitleSave = async (opts: SubtitleOptions) => {
    try {
      await api.patchJob(id, opts);
      showToast("Subtitle style saved · Applies from the next render");
      setOpenEditor(null);
      await fetchJob();
    } catch (e) {
      alert(`Failed to save subtitles: ${e}`);
    }
  };

  const handleApproveTtsReview = async () => {
    setApprovingTts(true);
    try {
      await api.approveTtsReview(id);
      showToast("Review complete · Starting final render");
      await fetchJob();
    } catch (e) {
      alert(`Review approval failed: ${e}`);
    } finally {
      setApprovingTts(false);
    }
  };

  const handleRegenerateTts = async () => {
    setRegeneratingTts(true);
    try {
      await api.patchJob(id, { script: { ...script, full_text: fullScriptText }, title });
      await api.regenerateTts(id);
      showToast("Script updated · Regenerating TTS");
      await fetchJob();
    } catch (e) {
      alert(`TTS regeneration failed: ${e}`);
    } finally {
      setRegeneratingTts(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>;
  }
  if (!job) {
    return <div className="text-center text-gray-500 mt-20">Job not found.</div>;
  }

  const videoUrl = job.output_path ? `${DIRECT_URL}/api/jobs/${id}/download` : null;
  const downloadReady = ["review_pending", "approved", "uploading", "published", "awaiting_tts_review"].includes(job.status);
  const isTtsReview = job.status === "awaiting_tts_review";
  const isFinalReview = job.status === "review_pending";
  const canEditCover = ["analyzed", "extracted", "awaiting_cover", "generating", "generated", "tts_processing", "tts_done", "awaiting_tts_review", "review_pending"].includes(job.status);

  // Cover card live thumbnail
  const coverBg = selectedFrame !== null ? frames[selectedFrame] : frames[0] ?? null;
  const coverThumbStyle = buildTextStyle({
    text: title, font: coverFamilyName || "Pretendard", size: coverFontSize, color: coverTitleColor,
    bold: coverBold, italic: coverItalic, topPct: COVER_POS_PCT[coverTitlePosition] ?? 50,
    strokeColor: coverStrokeColor, strokeWidth: coverStrokeWidth, shadow: true,
  });

  // Subtitle card live thumbnail (based on the job's saved values)
  const subFamilyName = fontFamilies.find((f) => f.regular === job.subtitle_font || f.bold === job.subtitle_font)?.name ?? "";
  const subSample = job.script?.hook?.slice(0, 16) || "Your subtitles appear here";
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
    <span style={{ fontSize: 11, color: "#34d399", background: "rgba(52,211,153,.12)", border: "1px solid rgba(52,211,153,.28)", borderRadius: 20, padding: "3px 9px", fontWeight: 700 }}>Set</span>
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

        {/* Breadcrumb + header */}
        <div className="flex items-center gap-2 text-xs" style={{ color: "#6b7a96" }}>
          <button onClick={() => router.back()} className="hover:text-white">← Jobs</button>
          <span style={{ color: "#3a465f" }}>/</span>
          <span style={{ color: "#cdd6ea" }}>#{id.slice(0, 8)}</span>
        </div>

        <div className="flex items-start gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight truncate" style={{ letterSpacing: "-0.03em" }}>
              {job.title || (job.source_urls?.length > 1 ? `${job.source_urls[0]} +${job.source_urls.length - 1} more` : job.source_url)}
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
              Download MP4
            </a>
          )}
        </div>

        {/* Next-step banner + steps */}
        {(isTtsReview || isFinalReview) && (
          <div className="flex items-center gap-3 flex-wrap" style={{ background: "linear-gradient(90deg,rgba(245,180,0,.10),rgba(245,180,0,0))", border: "1px solid rgba(245,180,0,.22)", borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245,180,0,.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flex: "none" }}>✓</div>
            <div className="min-w-0" style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: "#fbe3a1" }}>
                {isTtsReview ? "Next step — Review 1 · Check subtitles/voice" : "Next step — Review 2 · Approve final video"}
              </div>
              <div style={{ fontSize: 12.5, color: "#9aa6c0", marginTop: 2 }}>
                {isTtsReview ? "Check the cover and subtitles, then approve to start the final 1080p render." : "Check the final video, choose upload platforms, and approve."}
              </div>
            </div>
            <Steps active={isTtsReview ? 1 : 2} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

          {/* Left: preview + analysis + status */}
          <div className="space-y-4">
            <div style={card}>
              <div className="flex justify-between items-center mb-3">
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#9aa6c0" }}>
                  {isTtsReview ? "540p preview" : "Video preview"}
                </span>
                <span style={{ fontSize: 11, color: "#6b7a96", background: "#111a2b", border: "1px solid #21304c", borderRadius: 6, padding: "3px 7px" }}>
                  {isTtsReview ? "Low-res for review" : "9:16"}
                </span>
              </div>
              {videoUrl ? (
                <video src={videoUrl} controls className="rounded-xl w-full" style={{ aspectRatio: "9/16", background: "#000", border: "1px solid #1d2942" }} />
              ) : (
                <div className="flex items-center justify-center rounded-xl text-sm w-full" style={{ aspectRatio: "9/16", background: "#0b1220", color: "#5d6b88", border: "1px solid #1d2942" }}>
                  {["editing", "analyzing"].includes(job.status) ? "Processing…" : "No video"}
                </div>
              )}
            </div>

            {job.analysis_result && (
              <div style={card}>
                <h2 className="text-sm font-medium mb-3" style={{ color: "#9aa6c0" }}>AI analysis</h2>
                <div className="space-y-2 text-sm">
                  {job.analysis_result.product_name && (
                    <div><span style={{ color: "#6b7a96" }}>Product: </span><span className="text-white">{job.analysis_result.product_name}</span></div>
                  )}
                  {job.analysis_result.category && (
                    <div><span style={{ color: "#6b7a96" }}>Category: </span><span className="text-gray-300 text-xs">{job.analysis_result.category}</span></div>
                  )}
                  {job.analysis_result.key_features && job.analysis_result.key_features.length > 0 && (
                    <div>
                      <span className="block mb-1" style={{ color: "#6b7a96" }}>Key features:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {job.analysis_result.key_features.map((f, i) => <li key={i} className="text-gray-300 text-xs">{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {job.analysis_result.target_audience && (
                    <div><span style={{ color: "#6b7a96" }}>Target: </span><span className="text-gray-300 text-xs">{job.analysis_result.target_audience}</span></div>
                  )}
                  {job.analysis_result.pain_points && job.analysis_result.pain_points.length > 0 && (
                    <div>
                      <span className="block mb-1" style={{ color: "#6b7a96" }}>Pain points solved:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {job.analysis_result.pain_points.map((p, i) => <li key={i} className="text-gray-300 text-xs">{p}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={card}>
              <h2 className="text-sm font-medium mb-3" style={{ color: "#9aa6c0" }}>Processing status</h2>
              <div className="space-y-2 text-sm">
                {[
                  { key: "pending", label: "Pending" },
                  { key: "extracted", label: "Collected" },
                  { key: "analyzed", label: "AI analysis done" },
                  { key: "generated", label: "Script generated" },
                  { key: "tts_done", label: "TTS done" },
                  { key: "awaiting_tts_review", label: "Awaiting subtitle/voice review" },
                  { key: "review_pending", label: "Awaiting final review" },
                  { key: "published", label: "Published" },
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
                <button onClick={handleRetry} className="mt-3 text-xs px-3 py-1.5 rounded-lg" style={{ background: "#172238", color: "#cdd6ea" }}>Retry</button>
              )}
            </div>
          </div>

          {/* Right: editor cards */}
          <div className="space-y-4">

            {/* Cover card */}
            {canEditCover && (
              <div style={card}>
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>Cover</span>
                  {job.cover_frame_time && setBadge}
                </div>
                <div className="flex gap-4 items-center">
                  <div style={{ position: "relative", width: 78, height: 139, borderRadius: 10, overflow: "hidden", flex: "none", border: "1px solid #2a3650" }}>
                    <PreviewStage bg={coverBg} textStyle={coverThumbStyle} text={title} secondColor={coverTitleColor2 || null} style={{ width: "100%", height: "100%" }} />
                  </div>
                  <div className="min-w-0" style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: "#9aa6c0", lineHeight: 1.7 }}>
                      {selectedFrame !== null ? <>Frame <b style={{ color: "#cdd6ea" }}>#{selectedFrame + 1}</b> · </> : null}
                      {coverFamilyName || "Default font"}<br />Title {coverTitleColor} / Outline {coverStrokeWidth}
                    </div>
                    <button onClick={openCoverEditor} className="mt-3 w-full text-white font-bold rounded-lg" style={{ background: "#1d4ed8", fontSize: 14, padding: 11 }}>
                      Edit cover · Live preview
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Subtitle card */}
            <div style={card}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>Subtitle style</span>
                {job.subtitle_color && setBadge}
              </div>
              <div className="flex gap-4 items-center">
                <div style={{ position: "relative", width: 78, height: 139, borderRadius: 10, overflow: "hidden", flex: "none", border: "1px solid #2a3650" }}>
                  <PreviewStage bg={subBg} textStyle={subThumbStyle} text={subSample} style={{ width: "100%", height: "100%" }} />
                </div>
                <div className="min-w-0" style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: "#9aa6c0", lineHeight: 1.7 }}>
                    {subFamilyName || "Default font"} · {job.subtitle_color || "white"}<br />
                    Outline {job.subtitle_stroke_width ?? 0} · Position {normalizeSubPosition(job.subtitle_position)}/10
                  </div>
                  <button onClick={() => setOpenEditor("sub")} className="mt-3 w-full font-bold rounded-lg" style={{ background: "#172238", border: "1px solid #2a3650", color: "#e9eef7", fontSize: 14, padding: 11 }}>
                    Edit subtitles · Unified panel
                  </button>
                </div>
              </div>
            </div>

            {/* Script editor */}
            <div style={card} className="space-y-4">
              <h2 className="text-sm font-medium" style={{ color: "#9aa6c0" }}>Edit script</h2>
              <div>
                <label className="text-xs block mb-1" style={{ color: "#6b7a96" }}>Title (Reel title)</label>
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="AI-suggested title, or enter your own"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: "#0b1220", border: "1px solid #1d2942", color: "#e9eef7" }}
                />
              </div>
              {(script.hook || script.points.some(Boolean) || script.cta) && (
                <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(255,255,255,.03)" }}>
                  <p className="text-xs mb-2" style={{ color: "#6b7a96" }}>Script structure (read-only)</p>
                  {script.hook && <div className="text-xs"><span style={{ color: "#6b7a96" }}>Hook: </span><span className="text-gray-300">{script.hook}</span></div>}
                  {script.points.map((point, i) => point ? <div key={i} className="text-xs"><span style={{ color: "#6b7a96" }}>Point {i + 1}: </span><span className="text-gray-300">{point}</span></div> : null)}
                  {script.cta && <div className="text-xs"><span style={{ color: "#6b7a96" }}>CTA: </span><span className="text-gray-300">{script.cta}</span></div>}
                </div>
              )}
              <div>
                <label className="text-xs block mb-1" style={{ color: "#6b7a96" }}>Edit full script (takes priority for TTS once saved)</label>
                <textarea
                  value={fullScriptText} onChange={(e) => setFullScriptText(e.target.value)} rows={8}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none font-mono"
                  style={{ background: "#0b1220", border: "1px solid #1d2942", color: "#e9eef7" }}
                />
              </div>
              <button onClick={handleSaveScript} disabled={saving} className="w-full text-white px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#172238", border: "1px solid #2a3650", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save script"}
              </button>
            </div>

            {/* Caption editor */}
            <div style={card} className="space-y-4">
              <h2 className="text-sm font-medium" style={{ color: "#9aa6c0" }}>Edit caption</h2>
              <textarea
                value={caption} onChange={(e) => setCaption(e.target.value)} rows={4}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                style={{ background: "#0b1220", border: "1px solid #1d2942", color: "#e9eef7" }}
              />
              <button onClick={handleSaveCaption} disabled={saving} className="w-full text-white px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#172238", border: "1px solid #2a3650", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save caption"}
              </button>
            </div>

            {/* Review 1: TTS review */}
            {isTtsReview && (
              <div style={{ ...card, background: "rgba(245,180,0,.06)", borderColor: "rgba(245,180,0,.22)" }} className="space-y-3">
                <h2 className="text-sm font-medium" style={{ color: "#f5b400" }}>Subtitle/voice review</h2>
                <p className="text-xs" style={{ color: "#9aa6c0" }}>Check the subtitles and voice in the preview. Edit the script to regenerate TTS.</p>
                <div className="flex gap-3">
                  <button onClick={handleApproveTtsReview} disabled={approvingTts} className="flex-1 text-white px-4 py-3 rounded-xl text-sm font-extrabold" style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)", opacity: approvingTts ? 0.6 : 1 }}>
                    {approvingTts ? "Processing…" : "Approve → final 1080p render"}
                  </button>
                  <button onClick={handleRegenerateTts} disabled={regeneratingTts} className="px-4 py-3 rounded-xl text-sm font-bold" style={{ background: "#161f33", border: "1px solid #2a3650", color: "#b6c0d6", opacity: regeneratingTts ? 0.6 : 1 }}>
                    {regeneratingTts ? "Processing…" : "Save & regenerate"}
                  </button>
                </div>
              </div>
            )}

            {/* Review 2: final approval */}
            {isFinalReview && (
              <div style={card} className="space-y-4">
                <h2 className="text-sm font-medium" style={{ color: "#9aa6c0" }}>Choose upload platforms</h2>
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
                    {approving ? "Processing…" : "Approve & upload"}
                  </button>
                  <button onClick={handleReject} className="px-5 py-3 rounded-xl text-sm font-bold" style={{ background: "#161f33", border: "1px solid #2a3650", color: "#f87171" }}>Reject</button>
                </div>
              </div>
            )}

            {/* Quality evaluation */}
            {job.eval_scores && (
              <div style={card} className="space-y-3">
                <h2 className="text-sm font-medium" style={{ color: "#9aa6c0" }}>Quality evaluation</h2>
                {job.eval_scores.script && (
                  <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,.03)" }}>
                    <p className="text-xs mb-2" style={{ color: "#6b7a96" }}>Script evaluation</p>
                    <div className="flex gap-4 flex-wrap text-sm">
                      <div><span style={{ color: "#6b7a96" }}>Overall: </span><span className={job.eval_scores.script.overall_score >= 7 ? "text-green-400" : job.eval_scores.script.overall_score >= 5 ? "text-yellow-400" : "text-red-400"}>{job.eval_scores.script.overall_score}/10</span></div>
                      <div><span style={{ color: "#6b7a96" }}>Hook: </span><span className="text-gray-300">{job.eval_scores.script.hook_quality}/10</span></div>
                      <div><span style={{ color: "#6b7a96" }}>Flow: </span><span className="text-gray-300">{job.eval_scores.script.coherence}/10</span></div>
                      <div><span style={{ color: "#6b7a96" }}>Persona: </span><span className="text-gray-300">{job.eval_scores.script.persona_match}/10</span></div>
                      <div><span style={{ color: "#6b7a96" }}>Est. duration: </span><span className="text-gray-300">{job.eval_scores.script.timing_estimate}s</span></div>
                    </div>
                  </div>
                )}
                {job.eval_scores.tts && (
                  <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,.03)" }}>
                    <p className="text-xs mb-2" style={{ color: "#6b7a96" }}>TTS length</p>
                    <div className="flex gap-4 flex-wrap text-sm">
                      <div><span style={{ color: "#6b7a96" }}>Length: </span><span className="text-gray-300">{job.eval_scores.tts.duration}s</span></div>
                      <div><span style={{ color: "#6b7a96" }}>Limit: </span><span className="text-gray-300">{job.eval_scores.tts.limit}s</span></div>
                      <div><span style={{ color: "#6b7a96" }}>Over by: </span><span className={job.eval_scores.tts.over_by > 0 ? "text-red-400" : "text-gray-300"}>{job.eval_scores.tts.over_by > 0 ? `+${job.eval_scores.tts.over_by}s` : "None"}</span></div>
                      <div><span style={{ color: "#6b7a96" }}>Compliance: </span><span className={job.eval_scores.tts.compliance ? "text-green-400" : "text-red-400"}>{job.eval_scores.tts.compliance ? "OK" : "Over/under"}</span></div>
                    </div>
                  </div>
                )}
                {job.eval_scores.video && (
                  <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,.03)" }}>
                    <p className="text-xs mb-2" style={{ color: "#6b7a96" }}>Video quality</p>
                    <div className="flex gap-4 flex-wrap text-sm">
                      <div><span style={{ color: "#6b7a96" }}>Length: </span><span className="text-gray-300">{job.eval_scores.video.actual_duration}s</span></div>
                      <div><span style={{ color: "#6b7a96" }}>Black frames: </span><span className={job.eval_scores.video.has_black_frames ? "text-red-400" : "text-green-400"}>{job.eval_scores.video.has_black_frames ? "Detected" : "None"}</span></div>
                      <div><span style={{ color: "#6b7a96" }}>A/V sync: </span><span className={job.eval_scores.video.audio_video_sync ? "text-green-400" : "text-red-400"}>{job.eval_scores.video.audio_video_sync ? "OK" : "Out of sync"}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Publish results */}
            {job.instagram_post_id && (
              <div style={card} className="space-y-2">
                <h2 className="text-sm font-medium" style={{ color: "#9aa6c0" }}>Publish results</h2>
                {job.instagram_post_id && <p className="text-sm"><span style={{ color: "#6b7a96" }}>Instagram:</span> <span className="text-green-400">{job.instagram_post_id}</span></p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cover editor modal */}
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

      {/* Subtitle editor modal */}
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

      {/* Toast */}
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
      {dot(1, "Subtitles & voice")}
      <span style={{ width: 22, height: 1, background: "#2a3650" }} />
      {dot(2, "Final approval")}
    </div>
  );
}
