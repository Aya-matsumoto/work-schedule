"use client";
import { useState } from "react";

interface Staff { id: number; name: string; }
interface ProcessType { id: number; name: string; color: string; order: number; }

interface Props {
  bridgeId: number;
  bridgeName: string;
  projectName: string;
  staff: Staff[];
  processTypes: ProcessType[];
  initialDate?: string;
  onSave: (data: {
    bridgeId: number;
    processTypeId: number;
    staffId: number | null;
    startDate: string | null;
    endDate: string | null;
    note: string | null;
  }) => void;
  onClose: () => void;
}

export default function ProcessCreateModal({
  bridgeId, bridgeName, projectName, staff, processTypes, initialDate, onSave, onClose,
}: Props) {
  const [form, setForm] = useState({
    processTypeId: processTypes[0]?.id.toString() ?? "",
    staffId: "",
    startDate: initialDate ?? "",
    endDate: "",
    note: "",
  });

  const selectedType = processTypes.find((pt) => pt.id.toString() === form.processTypeId);

  const handleSave = () => {
    if (!form.processTypeId) return;
    onSave({
      bridgeId,
      processTypeId: parseInt(form.processTypeId),
      staffId: form.staffId ? parseInt(form.staffId) : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      note: form.note || null,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-96 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800 text-sm">工程を追加</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{projectName} ／ {bridgeName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* フォーム */}
        <div className="p-5 space-y-3">
          {/* 工程選択 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">工程 <span className="text-red-500">*</span></label>
            <select
              value={form.processTypeId}
              onChange={(e) => setForm((f) => ({ ...f, processTypeId: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
            >
              {processTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
            {selectedType && (
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded text-xs text-white"
                style={{ backgroundColor: selectedType.color }}
              >
                {selectedType.name}
              </span>
            )}
          </div>

          {/* 担当者 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">担当者</label>
            <select
              value={form.staffId}
              onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
            >
              <option value="">未定</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* 日程 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">着手予定日</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">完了予定日</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
              />
            </div>
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">備考</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="任意"
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
            />
          </div>
        </div>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50">
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!form.processTypeId}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-40"
          >
            登録
          </button>
        </div>
      </div>
    </div>
  );
}
