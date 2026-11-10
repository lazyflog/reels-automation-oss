"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api, Features, Job, JobsResponse, LibraryItem, Persona, Voice } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { useSettings } from "@/hooks/useSettings";


const _fontLoadCache = new Map<string, Promise<void>>();

function getFontFamilyId(path: string): string {
  return `preview-${path.split("/").pop()?.replace(".ttf", "") ?? "font"}`;
}

function loadPreviewFont(path: string): Promise<void> {
  if (_fontLoadCache.has(path)) return _fontLoadCache.get(path)!;
  const familyId = getFontFamilyId(path);
  const p = new FontFace(familyId, `url("/api/fonts/file?path=${encodeURIComponent(path)}")`).load()
    .then((face) => { document.fonts.add(face); })
    .catch(() => {});
  _fontLoadCache.set(path, p);
  return p;
}

function FontPreview({ fontPath }: { fontPath: string }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!fontPath) return;
    setLoaded(false);
    loadPreviewFont(fontPath).then(() => setLoaded(true));
  }, [fontPath]);

  return (
    <p
      className="text-sm text-gray-400 mt-1.5 px-1"
      style={{ fontFamily: loaded ? `"${getFontFamilyId(fontPath)}", sans-serif` : "inherit" }}
    >
      가나다라 ABC 123
    </p>
  );
}

const STATUS_FILTERS = [
  { label: "전체", value: "" },
  { label: "검수 대기", value: "review_pending" },
  { label: "TTS 검수", value: "awaiting_tts_review" },
  { label: "처리 중", value: "extracting" },
  { label: "게시됨", value: "published" },
  { label: "실패", value: "failed" },
];

const STEPS = [
  { label: "다운로드 중", statuses: ["pending", "extracting", "extracted"] },
  { label: "분석 중", statuses: ["analyzing", "analyzed", "removing_watermarks", "watermarks_removed"] },
  { label: "대본·음성 생성", statuses: ["generating", "generated", "tts_pending", "tts_processing", "tts_done"] },
  { label: "편집 중", statuses: ["editing", "awaiting_tts_review"] },
  { label: "완료!", statuses: ["review_pending", "approved", "uploading", "published"] },
];

const STEP_ICONS = ["⏳", "🔍", "📝", "🎬", "✅"];

function getStepIndex(status: string): number {
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (STEPS[i].statuses.includes(status)) return i;
  }
  return -1;
}

function isDownloadReady(status: string): boolean {
  return ["review_pending", "approved", "uploading", "published", "awaiting_tts_review"].includes(status);
}

function ActiveJobPanel({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const [job, setJob] = useState<Job | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const j = await api.getJob(jobId);
      setJob(j);
    } catch {
      // ignore
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
    const iv = setInterval(fetchJob, 5000);
    return () => clearInterval(iv);
  }, [fetchJob]);

  if (!job) return null;

  const stepIndex = getStepIndex(job.status);
  const failed = job.status === "failed";

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-blue-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-blue-400">진행 중인 작업</h2>
        <button onClick={onDone} className="text-xs text-gray-500 hover:text-gray-300">
          닫기
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4 truncate">
        {job.source_urls?.length > 1 ? `${job.source_urls[0]} 외 ${job.source_urls.length - 1}개` : job.source_url}
      </p>

      {failed ? (
        <div className="text-red-400 text-sm">
          처리 실패: {job.error_message || "알 수 없는 오류"}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            {STEPS.map((step, i) => {
              const active = i === stepIndex;
              const done = i < stepIndex;
              return (
                <div key={i} className="flex items-center gap-1">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                      done
                        ? "bg-green-900/50 text-green-400"
                        : active
                        ? "bg-blue-800 text-white font-medium"
                        : "bg-gray-800 text-gray-600"
                    }`}
                  >
                    <span>{STEP_ICONS[i]}</span>
                    <span>{step.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <span className="text-gray-700 text-xs">→</span>
                  )}
                </div>
              );
            })}
          </div>

          {isDownloadReady(job.status) && (
            <div className="flex gap-2 flex-wrap">
              <a
                href={api.downloadJobUrl(job.id)}
                download={`${job.id}.mp4`}
                className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm px-5 py-2 rounded-lg font-medium transition-colors"
              >
                mp4 다운로드
              </a>
              <a
                href={`/jobs/${job.id}`}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded-lg font-medium transition-colors"
              >
                상세보기
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function HomePage() {
  const { settings, updateSettings } = useSettings();
  const [urls, setUrls] = useState<string[]>([""]);
  const [description, setDescription] = useState("");
  const [bgmList, setBgmList] = useState<string[]>([]);
  const [fontList, setFontList] = useState<{ name: string; path: string }[]>([]);
  const [fontFamilies, setFontFamilies] = useState<{ name: string; regular: string; bold: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [data, setData] = useState<JobsResponse | null>(null);
  const [page, setPage] = useState(1);
  const bgmUploadRef = useRef<HTMLInputElement>(null);
  const [uploadingBgm, setUploadingBgm] = useState(false);
  const [bgmUrl, setBgmUrl] = useState("");
  const [downloadingBgm, setDownloadingBgm] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [features, setFeatures] = useState<Features | null>(null);
  const [sourceMode, setSourceMode] = useState<"upload" | "url">("upload");
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState("");
  const sourceFileRef = useRef<HTMLInputElement>(null);
  const [previewingTts, setPreviewingTts] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement>(null);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const subtitleCanvasRef = useRef<HTMLCanvasElement>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 라이브러리 참조
  const [hookExamples, setHookExamples] = useState<LibraryItem[]>([]);
  const [ctaExamples, setCtaExamples] = useState<LibraryItem[]>([]);
  const [showHooks, setShowHooks] = useState(false);
  const [showCtas, setShowCtas] = useState(false);

  const fetchHookExamples = async () => {
    try {
      const res = await api.listLibrary("hook");
      setHookExamples(res.items.filter((i) => i.is_active));
      setShowHooks(true);
    } catch { /* ignore */ }
  };

  const fetchCtaExamples = async () => {
    try {
      const res = await api.listLibrary("cta");
      setCtaExamples(res.items.filter((i) => i.is_active));
      setShowCtas(true);
    } catch { /* ignore */ }
  };

  const fetchJobs = useCallback(async () => {
    try {
      const result = await api.listJobs({ status: statusFilter || undefined, page, size: 20 });
      setData(result);
    } catch (e) {
      console.error(e);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    api.listBgm().then((res) => setBgmList(res.items)).catch(() => {});
    api.listFonts().then((res) => {
      setFontList(res.items);
      if (res.families) setFontFamilies(res.families);
    }).catch(() => {});
    api.listVoices().then((res) => {
      const active = res.items.filter((v) => v.is_active);
      setVoices(active);
      if (active.length > 0 && !active.some((v) => v.id === settings.voiceId)) {
        updateSettings({ voiceId: active[0].id });
      }
    }).catch(() => {});
    api.listPersonas().then((res) => {
      const active = res.items.filter((p) => p.is_active);
      setPersonas(active);
      // Persona is optional — clear a stored persona that no longer exists
      if (settings.persona && !active.some((p) => p.name === settings.persona)) {
        updateSettings({ persona: "" });
      }
    }).catch(() => {});
    api.getFeatures().then(setFeatures).catch(() => {});
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const addUrl = () => {
    if (urls.length < 10) setUrls((prev) => [...prev, ""]);
  };

  const removeUrl = (i: number) => {
    setUrls((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateUrl = (i: number, val: string) => {
    setUrls((prev) => prev.map((u, idx) => (idx === i ? val : u)));
  };

  const handleBgmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBgm(true);
    try {
      const res = await api.uploadBgm(file);
      const newList = [...bgmList, res.filename].sort();
      setBgmList(newList);
      updateSettings({ bgmFilename: res.filename });
    } catch (err) {
      alert(`업로드 실패: ${err}`);
    } finally {
      setUploadingBgm(false);
      if (bgmUploadRef.current) bgmUploadRef.current.value = "";
    }
  };

  const handleBgmFromUrl = async () => {
    if (!bgmUrl.trim()) return;
    setDownloadingBgm(true);
    try {
      const res = await api.downloadBgm(bgmUrl.trim());
      const newList = [...bgmList, res.filename].sort();
      setBgmList(newList);
      updateSettings({ bgmFilename: res.filename });
      setBgmUrl("");
    } catch (err) {
      alert(`BGM 다운로드 실패: ${err}`);
    } finally {
      setDownloadingBgm(false);
    }
  };

  const handleTtsPreview = async () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    setPreviewingTts(true);
    try {
      const blob = await api.previewTts(settings.voiceId, settings.ttsSpeed, settings.voiceVolume);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        ttsAudioRef.current = null;
      };
      ttsAudioRef.current = audio;
      await audio.play();
    } catch (err) {
      alert(`미리듣기 실패: ${err}`);
    } finally {
      setPreviewingTts(false);
    }
  };

  const handleBgmToggle = () => {
    const audio = bgmAudioRef.current;
    if (!audio) return;
    if (bgmPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setBgmPlaying(false);
    } else {
      if (settings.bgmFilename) {
        audio.src = api.bgmStreamUrl(settings.bgmFilename);
        audio.play();
        setBgmPlaying(true);
      }
    }
  };

  // BGM 변경 시 정지
  useEffect(() => {
    const audio = bgmAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setBgmPlaying(false);
    }
  }, [settings.bgmFilename]);

  // voice/speed 변경 시 이전 재생 정지
  useEffect(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
  }, [settings.voiceId, settings.ttsSpeed]);

  // Canvas 자막 미리보기
  const subtitlePositionY = useMemo(() => {
    const legacy: Record<string, number> = {
      top: 0.05, upper: 0.25, middle: 0.45, lower: 0.65, bottom: 0.85,
    };
    if (settings.subtitlePosition in legacy) return legacy[settings.subtitlePosition];
    const step = Math.max(1, Math.min(10, parseInt(settings.subtitlePosition) || 9));
    return 0.05 + (step - 1) * 0.1;
  }, [settings.subtitlePosition]);

  useEffect(() => {
    const canvas = subtitleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // 배경
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, w, h);

    // 가이드 라인
    ctx.strokeStyle = "#333";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // 자막 배경
    const textY = h * subtitlePositionY;
    const textH = 24;
    const textW = 120;
    const textX = (w - textW) / 2;
    if (settings.subtitleBgEnabled && settings.subtitleBgColor) {
      ctx.fillStyle = settings.subtitleBgColor;
      ctx.fillRect(textX - 4, textY - textH / 2 - 2, textW + 8, textH + 4);
    }

    // 자막 그림자
    const previewSize = Math.max(10, Math.round(settings.subtitleFontSize * 16 / 64));
    const weight = settings.subtitleBold ? "bold" : "normal";
    const fontStyle = settings.subtitleItalic ? "italic " : "";
    ctx.font = `${fontStyle}${weight} ${previewSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (settings.subtitleShadowColor) {
      ctx.save();
      if (settings.subtitleShadowBlur > 0) {
        ctx.filter = `blur(${settings.subtitleShadowBlur}px)`;
      }
      ctx.fillStyle = settings.subtitleShadowColor;
      ctx.fillText("자막 미리보기", w / 2, textY + settings.subtitleShadowOffset);
      ctx.restore();
    }

    // 자막 텍스트 (테두리 + 채우기)
    if (settings.subtitleStrokeWidth > 0) {
      ctx.strokeStyle = settings.subtitleStrokeColor;
      ctx.lineWidth = settings.subtitleStrokeWidth;
      ctx.lineJoin = "round";
      ctx.strokeText("자막 미리보기", w / 2, textY);
    }
    ctx.fillStyle = settings.subtitleColor;
    ctx.fillText("자막 미리보기", w / 2, textY);
  }, [settings.subtitleColor, settings.subtitleBgColor, settings.subtitleBgEnabled, subtitlePositionY,
      settings.subtitleShadowColor, settings.subtitleShadowOffset, settings.subtitleShadowBlur,
      settings.subtitleStrokeColor, settings.subtitleStrokeWidth,
      settings.subtitleFontSize, settings.subtitleBold]);

  const handleSourceFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setSourceFiles((prev) => [...prev, ...picked].slice(0, 10));
    if (sourceFileRef.current) sourceFileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validUrls = urls.filter((u) => u.trim());
    if (sourceMode === "url" && validUrls.length === 0) return;
    if (sourceMode === "upload" && sourceFiles.length === 0) return;
    setSubmitting(true);
    try {
      let sources: { urls?: string[]; upload_ids?: string[] };
      if (sourceMode === "upload") {
        const ids: string[] = [];
        for (let i = 0; i < sourceFiles.length; i++) {
          setUploadProgress(`Uploading ${i + 1}/${sourceFiles.length}…`);
          const up = await api.uploadSourceVideo(sourceFiles[i]);
          ids.push(up.upload_id);
        }
        sources = { upload_ids: ids };
      } else {
        sources = { urls: validUrls };
      }
      setUploadProgress("");
      const res = await api.createJob(
        sources,
        settings.persona || null,
        description.trim() || undefined,
        settings.voiceId || null,
        settings.subtitleColor,
        settings.subtitleBgEnabled ? settings.subtitleBgColor : null,
        settings.bgmFilename || null,
        settings.voiceVolume,
        settings.bgmVolume,
        settings.subtitleFont || null,
        settings.coverFont || null,
        settings.ttsSpeed,
        settings.subtitlePosition,
        settings.subtitleShadowColor,
        settings.subtitleShadowOffset,
        settings.subtitleShadowBlur,
        settings.subtitleStrokeColor,
        settings.subtitleStrokeWidth,
        settings.subtitleFontSize,
        settings.subtitleItalic,
      );
      setActiveJobId(res.job_id);
      setUrls([""]);
      setSourceFiles([]);
      setDescription("");
      await fetchJobs();
    } catch (err: unknown) {
      alert(`오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await api.deleteJob(id);
    if (activeJobId === id) setActiveJobId(null);
    await fetchJobs();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* URL 입력 */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h2 className="text-lg font-semibold mb-1">새 작업 추가</h2>
        <p className="text-xs text-gray-500 mb-4">
          같은 제품의 영상을 여러 개 입력하면 하나의 릴스로 합성됩니다 (최대 10개)
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Source: upload your own footage (default) or import from URLs */}
          {features?.url_import && (
            <div className="flex gap-2 text-xs">
              {(["upload", "url"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSourceMode(mode)}
                  className={`px-3 py-1.5 rounded-lg ${sourceMode === mode ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                >
                  {mode === "upload" ? "Upload files" : "From URL"}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500">
            Use only footage you own or are licensed to use.
          </p>

          {(sourceMode === "upload" || !features?.url_import) && (
            <div className="flex flex-col gap-2">
              {sourceFiles.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex gap-2 items-center text-sm">
                  <span className="flex-1 truncate bg-gray-800 border border-gray-700 rounded-lg px-4 py-2">
                    {f.name} <span className="text-gray-500">({(f.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSourceFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-gray-500 hover:text-red-400 px-2 text-lg"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
              {sourceFiles.length < 10 && (
                <button
                  type="button"
                  onClick={() => sourceFileRef.current?.click()}
                  className="self-start text-sm text-blue-400 hover:text-blue-300"
                >
                  + Add video files
                </button>
              )}
              <input
                ref={sourceFileRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm"
                multiple
                onChange={handleSourceFiles}
                className="hidden"
              />
            </div>
          )}

          {sourceMode === "url" && features?.url_import && (
          <div className="flex flex-col gap-2">
            {urls.map((url, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="url"
                  placeholder="https://… (a video you own or are licensed to use)"
                  value={url}
                  onChange={(e) => updateUrl(i, e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                {urls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeUrl(i)}
                    className="text-gray-500 hover:text-red-400 px-2 text-lg"
                    title="URL 제거"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {urls.length < 10 && (
              <button
                type="button"
                onClick={addUrl}
                className="text-xs text-blue-400 hover:text-blue-300 self-start px-2 py-1"
              >
                + URL 추가
              </button>
            )}
          </div>
          )}

          {/* 페르소나 + 제출 */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={settings.persona}
              onChange={(e) => updateSettings({ persona: e.target.value })}
              className="w-full sm:w-40 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">No persona</option>
              {personas.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? (uploadProgress || "처리 중...") : "작업 추가"}
            </button>
          </div>

          {/* 음성 설정 섹션 */}
          <div className="rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection("voice")}
              className="w-full flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2 cursor-pointer hover:bg-gray-800 transition-colors"
            >
              <span className="text-sm font-medium text-gray-300">음성 설정</span>
              <span className="text-gray-500 text-xs">{openSections.has("voice") ? "▼" : "▶"}</span>
            </button>
            {openSections.has("voice") && (
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 px-4 py-3">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <span>목소리</span>
                  <select
                    value={settings.voiceId}
                    onChange={(e) => updateSettings({ voiceId: e.target.value })}
                    className="w-full sm:w-36 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {voices.length === 0 && <option value="">음성 없음</option>}
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleTtsPreview}
                  disabled={previewingTts}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-gray-300"
                >
                  {previewingTts ? "로딩..." : "미리듣기"}
                </button>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <span>볼륨</span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.voiceVolume}
                    onChange={(e) => updateSettings({ voiceVolume: parseFloat(e.target.value) })}
                    className="w-full sm:w-20"
                  />
                  <span className="text-xs w-8">{Math.round(settings.voiceVolume * 100)}%</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <span>속도</span>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.05"
                    value={settings.ttsSpeed}
                    onChange={(e) => updateSettings({ ttsSpeed: parseFloat(e.target.value) })}
                    className="w-full sm:w-20"
                  />
                  <span className="text-xs w-8">{settings.ttsSpeed.toFixed(2)}x</span>
                </label>
              </div>
            )}
          </div>

          {/* 자막 설정 섹션 */}
          <div className="rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection("subtitle")}
              className="w-full flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2 cursor-pointer hover:bg-gray-800 transition-colors"
            >
              <span className="text-sm font-medium text-gray-300">자막 설정</span>
              <span className="text-gray-500 text-xs">{openSections.has("subtitle") ? "▼" : "▶"}</span>
            </button>
            {openSections.has("subtitle") && (
              <div className="flex flex-col gap-3 px-4 py-3">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <span>색상</span>
                    <input
                      type="color"
                      value={settings.subtitleColor}
                      onChange={(e) => updateSettings({ subtitleColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.subtitleBold}
                      onChange={(e) => updateSettings({ subtitleBold: e.target.checked })}
                      className="rounded"
                    />
                    <span className="font-bold">B</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.subtitleItalic}
                      onChange={(e) => updateSettings({ subtitleItalic: e.target.checked })}
                      className="rounded"
                    />
                    <span className="italic font-serif">I</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <span>크기</span>
                    <input
                      type="range"
                      min="32"
                      max="96"
                      step="4"
                      value={settings.subtitleFontSize}
                      onChange={(e) => updateSettings({ subtitleFontSize: parseInt(e.target.value) })}
                      className="w-full sm:w-20"
                    />
                    <span className="text-xs w-10">{settings.subtitleFontSize}px</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.subtitleBgEnabled}
                      onChange={(e) => updateSettings({ subtitleBgEnabled: e.target.checked })}
                      className="rounded"
                    />
                    <span>배경</span>
                  </label>
                  {settings.subtitleBgEnabled && (
                    <input
                      type="color"
                      value={settings.subtitleBgColor || "#000000"}
                      onChange={(e) => updateSettings({ subtitleBgColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                  )}
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <span>테두리</span>
                    <input
                      type="color"
                      value={settings.subtitleStrokeColor}
                      onChange={(e) => updateSettings({ subtitleStrokeColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <span>두께</span>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={settings.subtitleStrokeWidth}
                      onChange={(e) => updateSettings({ subtitleStrokeWidth: parseInt(e.target.value) })}
                      className="w-16"
                    />
                    <span className="text-xs w-4">{settings.subtitleStrokeWidth}</span>
                  </label>
                </div>
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <span>그림자</span>
                    <input
                      type="color"
                      value={settings.subtitleShadowColor}
                      onChange={(e) => updateSettings({ subtitleShadowColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <span>오프셋</span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={settings.subtitleShadowOffset}
                      onChange={(e) => updateSettings({ subtitleShadowOffset: parseInt(e.target.value) })}
                      className="w-16"
                    />
                    <span className="text-xs w-4">{settings.subtitleShadowOffset}</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <span>블러</span>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={settings.subtitleShadowBlur}
                      onChange={(e) => updateSettings({ subtitleShadowBlur: parseInt(e.target.value) })}
                      className="w-16"
                    />
                    <span className="text-xs w-4">{settings.subtitleShadowBlur}</span>
                  </label>
                </div>
                {/* 자막 위치 슬라이더 + Canvas 미리보기 */}
                <div className="flex gap-4 items-start flex-wrap">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <span>위치</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={parseInt(settings.subtitlePosition) || 9}
                        onChange={(e) => updateSettings({ subtitlePosition: e.target.value })}
                        className="w-32"
                      />
                      <span className="text-xs w-12">{parseInt(settings.subtitlePosition) || 9} / 10</span>
                    </label>
                  </div>
                  <canvas
                    ref={subtitleCanvasRef}
                    width={180}
                    height={320}
                    className="rounded-lg border border-gray-700 flex-shrink-0 w-32 sm:w-[180px] h-auto"
                  />
                </div>
              </div>
            )}
          </div>

          {/* BGM 설정 섹션 */}
          <div className="rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection("bgm")}
              className="w-full flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2 cursor-pointer hover:bg-gray-800 transition-colors"
            >
              <span className="text-sm font-medium text-gray-300">BGM 설정</span>
              <span className="text-gray-500 text-xs">{openSections.has("bgm") ? "▼" : "▶"}</span>
            </button>
            {openSections.has("bgm") && (
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 px-4 py-3">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <span>BGM</span>
                  <select
                    value={settings.bgmFilename || ""}
                    onChange={(e) => updateSettings({ bgmFilename: e.target.value || null })}
                    className="w-full sm:w-44 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">없음</option>
                    {bgmList.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </label>
                {settings.bgmFilename && (
                  <button
                    type="button"
                    onClick={handleBgmToggle}
                    className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
                  >
                    {bgmPlaying ? "정지" : "미리듣기"}
                  </button>
                )}
                <audio
                  ref={bgmAudioRef}
                  className="hidden"
                  onTimeUpdate={(e) => {
                    const audio = e.currentTarget;
                    if (audio.currentTime >= 30) {
                      audio.pause();
                      audio.currentTime = 0;
                      setBgmPlaying(false);
                    }
                  }}
                  onEnded={() => setBgmPlaying(false)}
                />
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <span>볼륨</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.bgmVolume}
                    onChange={(e) => updateSettings({ bgmVolume: parseFloat(e.target.value) })}
                    className="w-full sm:w-20"
                  />
                  <span className="text-xs w-8">{Math.round(settings.bgmVolume * 100)}%</span>
                </label>
                <button
                  type="button"
                  onClick={() => bgmUploadRef.current?.click()}
                  disabled={uploadingBgm}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-gray-300"
                >
                  {uploadingBgm ? "업로드 중..." : "업로드"}
                </button>
                <input
                  ref={bgmUploadRef}
                  type="file"
                  accept=".mp3,.wav,.m4a,.aac,.ogg"
                  onChange={handleBgmUpload}
                  className="hidden"
                />
                {features?.bgm_url_download && (<>
                <input
                  type="url"
                  placeholder="Audio URL (only audio you have rights to)"
                  value={bgmUrl}
                  onChange={(e) => setBgmUrl(e.target.value)}
                  className="w-full sm:w-52 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleBgmFromUrl}
                  disabled={downloadingBgm || !bgmUrl.trim()}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-gray-300"
                >
                  {downloadingBgm ? "다운로드 중..." : "URL 추가"}
                </button>
                </>)}
              </div>
            )}
          </div>

          {/* 폰트 설정 섹션 */}
          {(fontFamilies.length > 0 || fontList.length > 0) && (
            <div className="rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("font")}
                className="w-full flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2 cursor-pointer hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm font-medium text-gray-300">폰트 설정</span>
                <span className="text-gray-500 text-xs">{openSections.has("font") ? "▼" : "▶"}</span>
              </button>
              {openSections.has("font") && (() => {
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 py-3">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">자막 폰트</p>
                      <select
                        value={settings.subtitleFont || ""}
                        onChange={(e) => updateSettings({ subtitleFont: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                      >
                        {fontList.map((f) => (
                          <option key={f.path} value={f.path}>{f.name}</option>
                        ))}
                      </select>
                      <FontPreview fontPath={settings.subtitleFont} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">표지 폰트</p>
                      <select
                        value={settings.coverFont}
                        onChange={(e) => updateSettings({ coverFont: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                      >
                        {fontList.map((f) => (
                          <option key={f.path} value={f.path}>{f.name}</option>
                        ))}
                      </select>
                      <FontPreview fontPath={settings.coverFont} />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <textarea
            placeholder="상품 설명 (선택) — 예: 천연 성분 모이스처라이저, 민감성 피부 전용..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />

          {/* 라이브러리 참조 */}
          <div className="flex gap-2 flex-wrap items-start">
            <button
              type="button"
              onClick={() => showHooks ? setShowHooks(false) : fetchHookExamples()}
              className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
            >
              {showHooks ? "훅 예시 닫기" : "훅 예시 보기"}
            </button>
            <button
              type="button"
              onClick={() => showCtas ? setShowCtas(false) : fetchCtaExamples()}
              className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
            >
              {showCtas ? "CTA 예시 닫기" : "CTA 예시 보기"}
            </button>
            <a
              href="/library"
              className="text-xs px-3 py-1.5 text-blue-400 hover:text-blue-300"
            >
              라이브러리 관리 →
            </a>
          </div>
          {showHooks && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-2">등록된 훅 예시 (참고용)</p>
              {hookExamples.length === 0 ? (
                <p className="text-xs text-gray-600">
                  등록된 훅이 없습니다. <a href="/library" className="text-blue-400 hover:underline">/library에서 추가</a>
                </p>
              ) : (
                <ul className="space-y-1">
                  {hookExamples.map((item) => (
                    <li key={item.id} className="text-xs text-gray-300 flex gap-2">
                      <span className="text-gray-600">•</span>
                      <span>{item.content}</span>
                      {item.persona && <span className="text-gray-600 shrink-0">({item.persona})</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {showCtas && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-2">등록된 CTA 예시 (참고용)</p>
              {ctaExamples.length === 0 ? (
                <p className="text-xs text-gray-600">
                  등록된 CTA가 없습니다. <a href="/library" className="text-blue-400 hover:underline">/library에서 추가</a>
                </p>
              ) : (
                <ul className="space-y-1">
                  {ctaExamples.map((item) => (
                    <li key={item.id} className="text-xs text-gray-300 flex gap-2">
                      <span className="text-gray-600">•</span>
                      <span>{item.content}</span>
                      {item.persona && <span className="text-gray-600 shrink-0">({item.persona})</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>
      </div>

      {/* 실시간 진행 상태 */}
      {activeJobId && (
        <ActiveJobPanel jobId={activeJobId} onDone={() => setActiveJobId(null)} />
      )}

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              statusFilter === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-gray-500 text-sm self-center">
          총 {data?.total ?? 0}개
        </span>
      </div>

      {/* 작업 목록 */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm hidden sm:table">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left px-4 py-3">URL</th>
              <th className="text-left px-4 py-3">플랫폼</th>
              <th className="text-left px-4 py-3">상태</th>
              <th className="text-left px-4 py-3">생성일</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-500">
                  작업이 없습니다
                </td>
              </tr>
            )}
            {data?.items.map((job: Job) => (
              <tr key={job.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3 max-w-xs truncate">
                  <a
                    href={`/jobs/${job.id}`}
                    className="text-blue-400 hover:text-blue-300 truncate block"
                    title={job.source_urls?.join(", ") || job.source_url}
                  >
                    {job.source_urls && job.source_urls.length > 1
                      ? `${job.source_urls[0]} 외 ${job.source_urls.length - 1}개`
                      : job.source_url}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-400">{job.platform}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {formatDateTime(job.created_at)}
                </td>
                <td className="px-4 py-3 flex gap-2 justify-end">
                  {isDownloadReady(job.status) && (
                    <a
                      href={api.downloadJobUrl(job.id)}
                      download={`${job.id}.mp4`}
                      className="text-xs px-3 py-1 bg-green-900/50 hover:bg-green-900 text-green-400 rounded-md transition-colors"
                    >
                      다운로드
                    </a>
                  )}
                  <a
                    href={`/jobs/${job.id}`}
                    className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                  >
                    상세
                  </a>
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="text-xs px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-400 rounded-md transition-colors"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 모바일 카드 리스트 */}
        <div className="sm:hidden divide-y divide-gray-800">
          {data?.items.length === 0 && (
            <p className="text-center py-12 text-gray-500">작업이 없습니다</p>
          )}
          {data?.items.map((job: Job) => (
            <div key={job.id} className="p-4 space-y-2">
              <a
                href={`/jobs/${job.id}`}
                className="text-blue-400 hover:text-blue-300 text-sm block truncate"
                title={job.source_urls?.join(", ") || job.source_url}
              >
                {job.source_urls && job.source_urls.length > 1
                  ? `${job.source_urls[0]} 외 ${job.source_urls.length - 1}개`
                  : job.source_url}
              </a>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{job.platform}</span>
                <StatusBadge status={job.status} />
                <span className="ml-auto">{formatDateTime(job.created_at)}</span>
              </div>
              <div className="flex gap-2">
                {isDownloadReady(job.status) && (
                  <a
                    href={api.downloadJobUrl(job.id)}
                    download={`${job.id}.mp4`}
                    className="text-xs px-3 py-1 bg-green-900/50 hover:bg-green-900 text-green-400 rounded-md transition-colors"
                  >
                    다운로드
                  </a>
                )}
                <a
                  href={`/jobs/${job.id}`}
                  className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                >
                  상세
                </a>
                <button
                  onClick={() => handleDelete(job.id)}
                  className="text-xs px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-400 rounded-md transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 페이징 */}
      {data && data.total > 20 && (
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-sm"
          >
            이전
          </button>
          <span className="px-4 py-2 text-gray-400 text-sm">
            {page} / {Math.ceil(data.total / 20)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(data.total / 20)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-sm"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
