"use client";
import { useState } from "react";
import { toInputDate } from "@/lib/utils";

interface Staff { id: number; name: string; }

interface AssignmentRecord {
  id: number;
  staffId: number;
  startDate: string | null;
  endDate: string | null;
  isManual: boolean;
  staff: { id: number; name: string; color: string };
}

interface Props {
  assignment: AssignmentRecord;
  bridgeName: string;
  projectName: string;
  staff: Staff[];
  onSave: (data: {
    id: number;
    staffId: number;
    startDate: string | null;
    endDate: string | null;
  }) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export default function AssignmentEditModal({
  assignment, bridgeName, projectName, staff, onSave, onDelete, onClose,
}: Props) {
  const [form, setForm] = useState({
    staffId: assignment.staffId.toString(),
    startDate: toInputDate(assignment.startDate),
    endDate: toInputDate(assignment.endDate),
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    onSave({
      id: assignment.id,
      staffId: parseInt(form.staffId),
      startDate: form.startDate || null,
      endDate: form.endDate || null,
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
              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white bg-gray-500">
                📋 工数割り振り
              </span>
              {assignment.isManual && (
                <span className="text-xs text-orange-500 font-medium">✏ 手動修正済み</span>
              )}
            </div>
            <p className="text-sm font-bold text-gray-800 mt-1">{bridgeName}</p>
            <p className="text-xs text-gray-400">{projectName}</p>
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
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">開始日</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">終了日</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
              />
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between gap-2">
          {/* 削除ボタン */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-red-400 hover:text-red-600 border border-red-200 px-3 py-1.5 rounded hover:bg-red-50"
            >
              削除
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-500">本当に削除しますか？</span>
              <button
                onClick={() => onDelete(assignment.id)}
                className="text-sm bg-red-500 text-white px-3 py-1.5 rounded hover:bg-red-600"
              >
                削除する
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                戻る
              </button>
            </div>
          )}

          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
