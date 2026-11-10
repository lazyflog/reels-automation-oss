"use client";

import { useEffect, useState, useCallback } from "react";
import { api, Voice } from "@/lib/api";

export default function VoicesPage() {
  const [items, setItems] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);

  // 추가 폼
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formVoiceId, setFormVoiceId] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // 수정 중인 항목
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.listVoices();
      setItems(res.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCreate = async () => {
    if (!formName.trim() || !formVoiceId.trim()) return;
    setSaving(true);
    try {
      await api.createVoice({
        id: formVoiceId.trim(),
        name: formName.trim(),
        is_active: formActive,
      });
      setFormName("");
      setFormVoiceId("");
      setFormActive(true);
      setShowForm(false);
      await fetchItems();
    } catch (e) {
      alert(`추가 실패: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      await api.updateVoice(id, {
        name: editName.trim(),
        is_active: editActive,
      });
      setEditingId(null);
      await fetchItems();
    } catch (e) {
      alert(`수정 실패: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    try {
      await api.deleteVoice(id);
      await fetchItems();
    } catch (e) {
      alert(`삭제 실패: ${e}`);
    }
  };

  const handleToggleActive = async (item: Voice) => {
    try {
      await api.updateVoice(item.id, { is_active: !item.is_active });
      await fetchItems();
    } catch (e) {
      alert(`상태 변경 실패: ${e}`);
    }
  };

  const startEdit = (item: Voice) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditActive(item.is_active);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">음성 관리</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {showForm ? "취소" : "새 음성 추가"}
        </button>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-400">새 음성 추가</h3>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-400">
              <span>이름</span>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="예: 아담"
                className="w-full sm:w-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-400">
              <span>ElevenLabs Voice ID</span>
              <input
                type="text"
                value={formVoiceId}
                onChange={(e) => setFormVoiceId(e.target.value)}
                placeholder="예: pNInz6obpgDQGcFmaJgB"
                className="w-full sm:w-64 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="rounded"
              />
              <span>활성</span>
            </label>
            <button
              onClick={handleCreate}
              disabled={saving || !formName.trim() || !formVoiceId.trim()}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
            >
              {saving ? "저장 중..." : "추가"}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-gray-500">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            등록된 음성이 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">이름</th>
                <th className="text-left px-4 py-3">Voice ID</th>
                <th className="text-center px-4 py-3 w-16">활성</th>
                <th className="text-right px-4 py-3 w-28">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-800/50 transition-colors">
                  {editingId === item.id ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.id}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={(e) => setEditActive(e.target.checked)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => handleUpdate(item.id)}
                            disabled={saving}
                            className="text-xs px-2 py-1 bg-green-900/50 hover:bg-green-900 text-green-400 rounded-md"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-md"
                          >
                            취소
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-300">{item.name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.id}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`w-8 h-4 rounded-full relative transition-colors ${
                            item.is_active ? "bg-green-600" : "bg-gray-700"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                              item.is_active ? "left-4" : "left-0.5"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(item)}
                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-md"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-xs px-2 py-1 bg-red-900/50 hover:bg-red-900 text-red-400 rounded-md"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
