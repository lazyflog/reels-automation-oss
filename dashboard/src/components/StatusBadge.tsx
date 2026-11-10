"use client";

const STATUS_STYLES: Record<string, string> = {
  pending:             "bg-gray-700 text-gray-300",
  extracting:          "bg-blue-900 text-blue-300",
  extracted:           "bg-blue-800 text-blue-200",
  analyzing:           "bg-blue-900 text-blue-300",
  analyzed:            "bg-blue-800 text-blue-200",
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
  pending:             "Pending",
  extracting:          "Collecting",
  extracted:           "Collected",
  analyzing:           "Analyzing",
  analyzed:            "Analyzed",
  generating:          "Generating script",
  generated:           "Script ready",
  tts_pending:         "TTS queued",
  tts_processing:      "TTS processing",
  tts_done:            "TTS done",
  editing:             "Editing",
  awaiting_tts_review: "Awaiting TTS review",
  review_pending:      "Awaiting review",
  approved:            "Approved",
  uploading:           "Uploading",
  published:           "Published",
  rejected:            "Rejected",
  failed:              "Failed",
};

// In-progress statuses (show spinner)
const SPINNING_STATUSES = new Set([
  "pending",
  "extracting",
  "analyzing",
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
