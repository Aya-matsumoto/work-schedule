"use client";
import { useState } from "react";
import { toInputDate } from "@/lib/utils";

interface Staff { id: number; name: string; }
interface ProcessType { id: number; name: string; color: string; }
interface ProcessRecord {
  id: number;
  processTypeId: number;
  processType: ProcessType;
  staffId: number | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  completedDate: string | null;
  note: string | null;
}

interface Props {
  record: ProcessRecord;
  staff: Staff[];
  bridgeName: string;
  projectName: string;
  onSave: (data: {
    id: number;
    staffId: number | null;
    startDate: string | null;
    endDate: string | null;
    completedDate: string | null;
    note: string | null;
  }) => void;
  onClose: () => void;
}

export default function ProcessEditModal({ record, staff, bridgeName, projectName, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    staffId: record.staffId?.toString() ?? "",
    startDate: toInputDate(record.startDate),
    endDate: toInputDate(record.endDate),
    completedDate: toInputDate(record.completedDate),
    note: record.note ?? "",
  });

  const handleSave = () => {
    onSave({
      id: record.id,
      staffId: form.staffId ? parseInt(form.staffId) : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      completedDate: form.completedDate || null,
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
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: record.processType.color }}
              >
                {record.processType.name}
              </span>
              <span className="font-bold text-gray-800 text-sm">{bridgeName}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{projectName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* フォーム */}
        <div className="p-5 space-y-3">
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">完了日（実績）</label>
            <input
              type="date"
              value={form.completedDate}
              onChange={(e) => setForm((f) => ({ ...f, completedDate: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
            />
          </div>
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
          <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
