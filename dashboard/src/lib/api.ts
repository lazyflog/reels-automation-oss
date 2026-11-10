const API_URL = "";
// Use the browser's current origin so URLs are correct behind ngrok/custom domains too
const DIRECT_URL = typeof window !== "undefined" ? window.location.origin : "";

export interface Job {
  id: string;
  source_url: string;
  source_urls: string[];
  platform: string;
  status: string;
  title: string | null;
  script: {
    hook: string;
    points: string[];
    cta: string;
    disclaimer?: string;
    full_text?: string;
  } | null;
  caption: string | null;
  analysis_result: {
    product_name?: string;
    category?: string;
    key_features?: string[];
    usage_method?: string;
    target_audience?: string;
    pain_points?: string[];
    suggested_title?: string;
    product_info?: string;
  } | null;
  output_path: string | null;
  cover_image_path: string | null;
  cover_frame_time: string | null;
  instagram_post_id: string | null;
  upload_targets: string[];
  error_message: string | null;
  retry_count: number;
  persona: string | null;
  voice_id: string | null;
  voice_volume: number;
  bgm_volume: number;
  subtitle_color: string;
  subtitle_bg_color: string | null;
  bgm_filename: string | null;
  subtitle_font: string | null;
  cover_font: string | null;
  tts_speed: number | null;
  subtitle_position: string | null;
  cover_font_size: number | null;
  cover_title_color: string | null;
  cover_title_color2: string | null;
  subtitle_shadow_color: string | null;
  subtitle_shadow_offset: number | null;
  subtitle_shadow_blur: number | null;
  subtitle_stroke_color: string | null;
  subtitle_stroke_width: number | null;
  cover_title_position: string | null;
  subtitle_font_size: number | null;
  subtitle_italic: boolean | null;
  cover_italic: boolean | null;
  cover_stroke_color: string | null;
  cover_stroke_width: number | null;
  eval_scores: {
    script?: {
      overall_score: number;
      hook_quality: number;
      coherence: number;
      persona_match: number;
      timing_estimate: number;
      evaluated_at: string;
    };
    tts?: {
      duration: number;
      video_duration: number;
      limit: number;
      over_by: number;
      compliance: boolean;
      evaluated_at: string;
    };
    video?: {
      has_black_frames: boolean;
      actual_duration: number;
      audio_video_sync: boolean;
      evaluated_at: string;
    };
  } | null;
  created_at: string;
  updated_at: string;
}

export interface JobsResponse {
  total: number;
  page: number;
  size: number;
  items: Job[];
}

export interface LibraryItem {
  id: string;
  category: string;
  content: string;
  persona: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Voice {
  id: string;          // = ElevenLabs voice ID
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  speech_style: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Features {
  bgm_url_download: boolean;
  url_import: boolean;
  xhs_import: boolean;
  max_upload_mb: number;
  content_language: string;
}

export interface ReportResponse {
  uploads: {
    today: number;
    this_week: number;
    this_month: number;
  };
  status_counts: Record<string, number>;
  recent_published: {
    id: string;
    platform: string;
    instagram_post_id: string | null;
    published_at: string | null;
  }[];
}

export interface CoverOptions {
  cover_title?: string;
  cover_font?: string | null;
  cover_font_size?: number;
  cover_title_color?: string;
  cover_title_color2?: string | null;
  cover_title_position?: string;
  cover_italic?: boolean;
  cover_stroke_color?: string | null;
  cover_stroke_width?: number;
}

export interface SubtitleOptions {
  subtitle_color?: string;
  subtitle_bg_color?: string | null;
  subtitle_font?: string | null;
  subtitle_font_size?: number;
  subtitle_italic?: boolean;
  subtitle_position?: string;
  subtitle_stroke_color?: string | null;
  subtitle_stroke_width?: number;
  subtitle_shadow_color?: string | null;
  subtitle_shadow_offset?: number;
  subtitle_shadow_blur?: number;
}

export type PatchJobData = {
  script?: Job["script"];
  caption?: string;
  title?: string;
} & SubtitleOptions;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
    ...options,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API Error ${res.status}: ${err}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  uploadSourceVideo: (file: File) => {
    // Plain fetch: request() forces a JSON Content-Type, which breaks multipart uploads
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_URL}/api/jobs/uploads`, {
      method: "POST",
      body: form,
      credentials: "include",
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
      return res.json() as Promise<{ upload_id: string; filename: string; size: number }>;
    });
  },

  createJob: (
    sources: { urls?: string[]; upload_ids?: string[] },
    persona: string | null,
    description?: string,
    voice_id?: string | null,
    subtitle_color?: string,
    subtitle_bg_color?: string | null,
    bgm_filename?: string | null,
    voice_volume?: number,
    bgm_volume?: number,
    subtitle_font?: string | null,
    cover_font?: string | null,
    tts_speed?: number | null,
    subtitle_position?: string,
    subtitle_shadow_color?: string | null,
    subtitle_shadow_offset?: number | null,
    subtitle_shadow_blur?: number | null,
    subtitle_stroke_color?: string | null,
    subtitle_stroke_width?: number | null,
    subtitle_font_size?: number | null,
    subtitle_italic?: boolean,
  ) =>
    request<{ job_id: string; status: string; platform: string }>("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        urls: sources.urls ?? [], upload_ids: sources.upload_ids ?? [],
        persona, description, voice_id,
        subtitle_color, subtitle_bg_color, bgm_filename,
        voice_volume, bgm_volume,
        subtitle_font, cover_font, tts_speed, subtitle_position,
        subtitle_shadow_color, subtitle_shadow_offset, subtitle_shadow_blur,
        subtitle_stroke_color, subtitle_stroke_width, subtitle_font_size,
        subtitle_italic,
      }),
    }),

  previewTts: (voice_id: string, speed: number, voice_volume = 1.0) =>
    fetch("/api/tts/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ voice_id, speed, voice_volume }),
    }).then((res) => {
      if (!res.ok) throw new Error("TTS preview failed");
      return res.blob();
    }),

  bgmStreamUrl: (filename: string) => `/api/bgm/${encodeURIComponent(filename)}/stream`,

  listFonts: () => request<{ items: { name: string; path: string }[]; families: { name: string; regular: string; bold: string }[] }>("/api/fonts"),

  listBgm: () => request<{ items: string[] }>("/api/bgm"),

  listJobs: (params?: { status?: string; page?: number; size?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.size) qs.set("size", String(params.size));
    return request<JobsResponse>(`/api/jobs?${qs}`);
  },

  getJob: (id: string) => request<Job>(`/api/jobs/${id}`),

  patchJob: (id: string, data: PatchJobData) =>
    request<Job>(`/api/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getFrames: (id: string) =>
    request<{ frames: string[]; video_path: string; frame_times: number[] }>(`/api/jobs/${id}/frames`),

  setCover: (id: string, frame_time: number, opts: CoverOptions = {}) =>
    request<Job>(`/api/jobs/${id}/cover`, {
      method: "POST",
      body: JSON.stringify({ frame_time, ...opts }),
    }),

  previewCover: (id: string, frame_time: number, opts: CoverOptions = {}) =>
    fetch(`/api/jobs/${id}/preview-cover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ frame_time, ...opts }),
    }).then((res) => {
      if (!res.ok) throw new Error("Failed to generate cover preview");
      return res.blob();
    }),

  downloadBgm: (url: string) =>
    request<{ filename: string }>("/api/bgm/download", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  approveTtsReview: (id: string) =>
    request<{ job_id: string; status: string }>(`/api/jobs/${id}/approve_tts_review`, {
      method: "POST",
    }),

  uploadBgm: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch("/api/bgm/upload", {
      method: "POST",
      body: form,
      credentials: "include",
    }).then((res) => {
      if (!res.ok) throw new Error(`BGM upload failed: ${res.status}`);
      return res.json() as Promise<{ filename: string }>;
    });
  },

  approveJob: (id: string, targets: string[]) =>
    request<{ job_id: string; status: string; targets: string[] }>(`/api/jobs/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ targets }),
    }),

  rejectJob: (id: string) =>
    request<{ job_id: string; status: string }>(`/api/jobs/${id}/reject`, { method: "POST" }),

  retryJob: (id: string) =>
    request<{ job_id: string; status: string }>(`/api/jobs/${id}/retry`, { method: "POST" }),

  regenerateTts: (id: string) =>
    request<{ job_id: string; status: string }>(`/api/jobs/${id}/regenerate_tts`, { method: "POST" }),

  deleteJob: (id: string) => request<void>(`/api/jobs/${id}`, { method: "DELETE" }),

  getReport: () => request<ReportResponse>("/api/report"),

  login: (username: string, password: string) =>
    request<{ username: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  me: () => request<{ id: string; username: string }>("/api/auth/me"),

  downloadJobUrl: (id: string) => `${DIRECT_URL}/api/jobs/${id}/download`,

  getFeatures: () => request<Features>("/api/features"),

  // Persona CRUD
  listPersonas: (activeOnly?: boolean) => {
    const qs = activeOnly ? "?active_only=true" : "";
    return request<{ items: Persona[] }>(`/api/personas${qs}`);
  },

  createPersona: (data: { name: string; description?: string; speech_style?: string; is_active?: boolean; sort_order?: number }) =>
    request<Persona>("/api/personas", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePersona: (id: string, data: { name?: string; description?: string; speech_style?: string; is_active?: boolean; sort_order?: number }) =>
    request<Persona>(`/api/personas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deletePersona: (id: string) =>
    request<void>(`/api/personas/${id}`, { method: "DELETE" }),

  // Voice CRUD
  listVoices: () => request<{ items: Voice[] }>("/api/voices"),

  createVoice: (data: { id: string; name: string; is_active?: boolean }) =>
    request<Voice>("/api/voices", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateVoice: (id: string, data: { name?: string; is_active?: boolean }) =>
    request<Voice>(`/api/voices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteVoice: (id: string) =>
    request<void>(`/api/voices/${id}`, { method: "DELETE" }),

  // Library CRUD
  listLibrary: (category?: string, persona?: string) => {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (persona) qs.set("persona", persona);
    return request<{ items: LibraryItem[] }>(`/api/library?${qs}`);
  },

  createLibrary: (data: { category: string; content: string; persona?: string | null; is_active?: boolean }) =>
    request<LibraryItem>("/api/library", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateLibrary: (id: string, data: { category?: string; content?: string; persona?: string | null; is_active?: boolean }) =>
    request<LibraryItem>(`/api/library/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteLibrary: (id: string) =>
    request<void>(`/api/library/${id}`, { method: "DELETE" }),
};
