"use client";

import { useEffect, useState, useCallback } from "react";
import { api, LibraryItem, Persona } from "@/lib/api";

const CATEGORIES = [
  { label: "Hook", value: "hook" },
  { label: "CTA", value: "cta" },
  { label: "Script", value: "script" },
];

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("hook");
  const [personaNames, setPersonaNames] = useState<string[]>([]);

  useEffect(() => {
    api.listPersonas()
      .then((res: { items: Persona[] }) => setPersonaNames(res.items.map((p) => p.name)))
      .catch(() => {});
  }, []);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [formContent, setFormContent] = useState("");
  const [formPersona, setFormPersona] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Item being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editPersona, setEditPersona] = useState("");
  const [editActive, setEditActive] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.listLibrary(activeTab);
      setItems(res.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    fetchItems();
  }, [fetchItems]);

  const handleCreate = async () => {
    if (!formContent.trim()) return;
    setSaving(true);
    try {
      await api.createLibrary({
        category: activeTab,
        content: formContent.trim(),
        persona: formPersona || null,
        is_active: formActive,
      });
      setFormContent("");
      setFormPersona("");
      setFormActive(true);
      setShowForm(false);
      await fetchItems();
    } catch (e) {
      alert(`Failed to add: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      await api.updateLibrary(id, {
        content: editContent.trim(),
        persona: editPersona || null,
        is_active: editActive,
      });
      setEditingId(null);
      await fetchItems();
    } catch (e) {
      alert(`Failed to update: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    try {
      await api.deleteLibrary(id);
      await fetchItems();
    } catch (e) {
      alert(`Failed to delete: ${e}`);
    }
  };

  const handleToggleActive = async (item: LibraryItem) => {
    try {
      await api.updateLibrary(item.id, { is_active: !item.is_active });
      await fetchItems();
    } catch (e) {
      alert(`Failed to change status: ${e}`);
    }
  };

  const startEdit = (item: LibraryItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
    setEditPersona(item.persona || "");
    setEditActive(item.is_active);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Prompt library</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {showForm ? "Cancel" : "Add item"}
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => { setActiveTab(cat.value); setShowForm(false); setEditingId(null); }}
            className={`px-5 py-2 rounded-full text-sm transition-colors ${
              activeTab === cat.value
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-400">
            New {CATEGORIES.find((c) => c.value === activeTab)?.label} example
          </h3>
          <textarea
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            rows={3}
            placeholder="Enter example text…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
          <div className="flex gap-3 items-center flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <span>Persona</span>
              <select
                value={formPersona}
                onChange={(e) => setFormPersona(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">All personas</option>
                {personaNames.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="rounded"
              />
              <span>Active</span>
            </label>
            <button
              onClick={handleCreate}
              disabled={saving || !formContent.trim()}
              className="ml-auto px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
            >
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No {CATEGORIES.find((c) => c.value === activeTab)?.label} examples yet.
          </div>
        ) : (
          <>
          <table className="w-full text-sm hidden sm:table">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Content</th>
                <th className="text-left px-4 py-3 w-28">Persona</th>
                <th className="text-center px-4 py-3 w-16">Active</th>
                <th className="text-right px-4 py-3 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-800/50 transition-colors">
                  {editingId === item.id ? (
                    <>
                      <td className="px-4 py-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={2}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500 resize-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={editPersona}
                          onChange={(e) => setEditPersona(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Shared</option>
                          {personaNames.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>
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
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-md"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-300 whitespace-pre-wrap">{item.content}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{item.persona || "Shared"}</td>
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
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-xs px-2 py-1 bg-red-900/50 hover:bg-red-900 text-red-400 rounded-md"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-gray-800">
            {items.map((item) => (
              <div key={item.id} className="p-4 space-y-2">
                {editingId === item.id ? (
                  <>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500 resize-none"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={editPersona}
                        onChange={(e) => setEditPersona(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Shared</option>
                        {personaNames.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={(e) => setEditActive(e.target.checked)}
                          className="rounded"
                        />
                        <span>Active</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(item.id)}
                        disabled={saving}
                        className="text-xs px-3 py-1 bg-green-900/50 hover:bg-green-900 text-green-400 rounded-md"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-gray-300 whitespace-pre-wrap text-sm">{item.content}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{item.persona || "Shared"}</span>
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
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={() => startEdit(item)}
                          className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-xs px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-400 rounded-md"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
