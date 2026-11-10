"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api, ReportResponse } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  pending: "#6b7280",
  extracting: "#3b82f6",
  extracted: "#60a5fa",
  generating: "#3b82f6",
  generated: "#60a5fa",
  tts_processing: "#3b82f6",
  tts_done: "#60a5fa",
  editing: "#8b5cf6",
  review_pending: "#f59e0b",
  approved: "#6366f1",
  rejected: "#ef4444",
  uploading: "#a855f7",
  published: "#22c55e",
  failed: "#dc2626",
};

export default function ReportPage() {
  const [report, setReport] = useState<ReportResponse | null>(null);

  useEffect(() => {
    api.getReport().then(setReport).catch(console.error);
  }, []);

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>
    );
  }

  const pieData = Object.entries(report.status_counts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ name: status, value: count }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Report</h1>

      {/* Upload count cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Today", value: report.uploads.today },
          { label: "This week", value: report.uploads.this_week },
          { label: "This month", value: report.uploads.this_month },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-gray-900 rounded-xl border border-gray-800 p-5 text-center"
          >
            <p className="text-gray-500 text-sm mb-1">{item.label}</p>
            <p className="text-4xl font-bold text-white">{item.value}</p>
            <p className="text-gray-500 text-xs mt-1">Published</p>
          </div>
        ))}
      </div>

      {/* Donut chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-sm font-medium text-gray-400 mb-4">Status breakdown</h2>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={STATUS_COLORS[entry.name] || "#6b7280"}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "1px solid #374151" }}
                labelStyle={{ color: "#f3f4f6" }}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-500">No data</div>
        )}
      </div>

      {/* Recently published */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-medium text-gray-400">Recently published Reels</h2>
        </div>
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left px-5 py-3">Platform</th>
              <th className="text-left px-5 py-3">Instagram ID</th>
              <th className="text-left px-5 py-3">Published</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {report.recent_published.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-10 text-gray-500">
                  No published Reels yet
                </td>
              </tr>
            )}
            {report.recent_published.map((item) => (
              <tr key={item.id} className="hover:bg-gray-800/50">
                <td className="px-5 py-3 text-gray-400">{item.platform}</td>
                <td className="px-5 py-3 text-pink-400">
                  {item.instagram_post_id || "-"}
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {item.published_at
                    ? formatDateTime(item.published_at)
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
