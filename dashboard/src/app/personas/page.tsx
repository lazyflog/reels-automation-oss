"use client";

import { useEffect, useState, useCallback } from "react";
import { api, Persona } from "@/lib/api";

export default function PersonasPage() {
  const [items, setItems] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStyle, setFormStyle] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formOrder, setFormOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  // Item being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStyle, setEditStyle] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editOrder, setEditOrder] = useState(0);

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.listPersonas();
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
    if (!formName.trim()) return;
    setSaving(true);
    try {
      await api.createPersona({
        name: formName.trim(),
        description: formDesc.trim(),
        speech_style: formStyle.trim(),
        is_active: formActive,
        sort_order: formOrder,
      });
      setFormName("");
      setFormDesc("");
      setFormStyle("");
      setFormActive(true);
      setFormOrder(0);
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
      await api.updatePersona(id, {
        name: editName.trim(),
        description: editDesc.trim(),
        speech_style: editStyle.trim(),
        is_active: editActive,
        sort_order: editOrder,
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
      await api.deletePersona(id);
      await fetchItems();
    } catch (e) {
      alert(`Failed to delete: ${e}`);
    }
  };

  const handleToggleActive = async (item: Persona) => {
    try {
      await api.updatePersona(item.id, { is_active: !item.is_active });
      await fetchItems();
    } catch (e) {
      alert(`Failed to change status: ${e}`);
    }
  };

  const startEdit = (item: Persona) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDesc(item.description);
    setEditStyle(item.speech_style);
    setEditActive(item.is_active);
    setEditOrder(item.sort_order);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Personas</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {showForm ? "Cancel" : "Add persona"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-400">Add persona</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-400">
              <span>Name <span className="text-red-400">*</span></span>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Busy new mom"
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-400">
              <span>Sort order</span>
              <input
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 w-full sm:w-24"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-gray-400">
            <span>Profile</span>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Age range, job/situation, interests, personality, etc."
              rows={3}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-y"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-400">
            <span>Tone guidelines</span>
            <textarea
              value={formStyle}
              onChange={(e) => setFormStyle(e.target.value)}
              placeholder="Phrasing to use, tone traits, patterns to avoid, etc."
              rows={4}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-y"
            />
          </label>
          <div className="flex items-center justify-between">
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
              disabled={saving || !formName.trim()}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
            >
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No personas yet.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
            >
              {editingId === item.id ? (
                /* Edit mode */
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-sm text-gray-400">
                      <span>Name</span>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-gray-400">
                      <span>Sort order</span>
                      <input
                        type="number"
                        value={editOrder}
                        onChange={(e) => setEditOrder(Number(e.target.value))}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 w-full sm:w-24"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    <span>Profile</span>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-y"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    <span>Tone guidelines</span>
                    <textarea
                      value={editStyle}
                      onChange={(e) => setEditStyle(e.target.value)}
                      rows={4}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-y"
                    />
                  </label>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                        className="rounded"
                      />
                      <span>Active</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdate(item.id)}
                        disabled={saving}
                        className="text-sm px-3 py-1.5 bg-green-900/50 hover:bg-green-900 text-green-400 rounded-lg disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`shrink-0 w-8 h-4 rounded-full relative transition-colors ${
                          item.is_active ? "bg-green-600" : "bg-gray-700"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                            item.is_active ? "left-4" : "left-0.5"
                          }`}
                        />
                      </button>
                      <span className="font-medium text-white">{item.name}</span>
                      <span className="text-xs text-gray-500">Order {item.sort_order}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
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
                  </div>
                  {item.description && (
                    <div className="mt-2 text-sm text-gray-400">
                      <span className="text-gray-600 text-xs mr-1">Profile</span>
                      {item.description}
                    </div>
                  )}
                  {item.speech_style && (
                    <div className="mt-1 text-sm text-gray-400">
                      <span className="text-gray-600 text-xs mr-1">Tone</span>
                      {item.speech_style}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
