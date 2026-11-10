"use client";

const STATUS_STYLES: Record<string, string> = {
  pending:             "bg-gray-700 text-gray-300",
  extracting:          "bg-blue-900 text-blue-300",
  extracted:           "bg-blue-800 text-blue-200",
  analyzing:           "bg-blue-900 text-blue-300",
  analyzed:            "bg-blue-800 text-blue-200",
  removing_watermarks: "bg-blue-900 text-blue-300",
  watermarks_removed:  "bg-blue-800 text-blue-200",
  generating:          "bg-blue-900 text-blue-300",
  generated:           "bg-blue-800 text-blue-200",
  tts_pending:         "bg-blue-900 text-blue-300",
  tts_processing:      "bg-blue-900 text-blue-300",
  tts_done:            "bg-blue-800 text-blue-200",
  editing:             "bg-blue-900 text-blue-300",
  awaiting_tts_review: "bg-yellow-900 text-yellow-300",
  review_pending:      "bg-yellow-900 text-yellow-300",
  approved:            "bg-indigo-900 text-indigo-300",
  uploading:           "bg-purple-900 text-purple-300",
  published:           "bg-green-900 text-green-300",
  rejected:            "bg-red-900 text-red-300",
  failed:              "bg-red-900 text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending:             "대기",
  extracting:          "수집 중",
  extracted:           "수집 완료",
  analyzing:           "분석 중",
  analyzed:            "분석 완료",
  removing_watermarks: "워터마크 제거 중",
  watermarks_removed:  "워터마크 제거 완료",
  generating:          "대본 생성 중",
  generated:           "대본 완료",
  tts_pending:         "TTS 대기 중",
  tts_processing:      "TTS 처리 중",
  tts_done:            "TTS 완료",
  editing:             "편집 중",
  awaiting_tts_review: "TTS 검수 대기",
  review_pending:      "검수 대기",
  approved:            "승인됨",
  uploading:           "업로드 중",
  published:           "게시됨",
  rejected:            "반려됨",
  failed:              "실패",
};

// 진행 중(스피너 표시) 상태
const SPINNING_STATUSES = new Set([
  "pending",
  "extracting",
  "analyzing",
  "removing_watermarks",
  "generating",
  "tts_pending",
  "tts_processing",
  "editing",
  "uploading",
]);

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || "bg-gray-700 text-gray-300";
  const label = STATUS_LABELS[status] || status;
  const spinning = SPINNING_STATUSES.has(status);

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {spinning && (
        <span className="inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      )}
      {label}
    </span>
  );
}
