"use client";
import { useState } from "react";

interface Bridge { id: number; name: string; }
interface Project { id: number; name: string; bridges: Bridge[]; }
interface ProcessType { id: number; name: string; color: string; order: number; }

interface Props {
  staffId: number;
  staffName: string;
  projects: Project[];
  processTypes: ProcessType[];
  initialDate?: string;
  onSave: (data: {
    staffId: number;
    projectId?: number;
    bridgeId?: number;
    processTypeId: number;
    startDate: string | null;
    endDate: string | null;
    note: string | null;
  }) => void;
  onClose: () => void;
}

export default function StaffProcessCreateModal({
  staffId, staffName, projects, processTypes, initialDate, onSave, onClose,
}: Props) {
  const [form, setForm] = useState({
    projectId: "",
    bridgeId: "",
    processTypeId: processTypes[0]?.id.toString() ?? "",
    startDate: initialDate ?? "",
    endDate: "",
    note: "",
  });

  const selectedProject = projects.find((p) => p.id.toString() === form.projectId);
  const selectedType = processTypes.find((pt) => pt.id.toString() === form.processTypeId);

  const handleProjectChange = (val: string) => {
    setForm((f) => ({ ...f, projectId: val, bridgeId: "" }));
  };

  const handleSave = () => {
    if (!form.processTypeId || !form.projectId) return;
    onSave({
      staffId,
      projectId: parseInt(form.projectId),
      bridgeId: form.bridgeId ? parseInt(form.bridgeId) : undefined,
      processTypeId: parseInt(form.processTypeId),
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      note: form.note || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-96 mx-4" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div>
            <span className="font-bold text-gray-800 text-sm">予定を追加</span>
            <p className="text-xs text-gray-400 mt-0.5">担当者：{staffName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* フォーム */}
        <div className="p-5 space-y-3">
          {/* 業務選択 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">業務 <span className="text-red-500">*</span></label>
            <select
              value={form.projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
            >
              <option value="">選択してください</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 橋梁選択（任意） */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">橋梁（任意）</label>
            <select
              value={form.bridgeId}
              onChange={(e) => setForm((f) => ({ ...f, bridgeId: e.target.value }))}
              disabled={!selectedProject}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">業務全体（橋梁指定なし）</option>
              {(selectedProject?.bridges ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

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
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs text-white" style={{ backgroundColor: selectedType.color }}>
                {selectedType.name}
              </span>
            )}
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
          <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50">キャンセル</button>
          <button
            onClick={handleSave}
            disabled={!form.processTypeId || !form.projectId}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-40"
          >
            登録
          </button>
        </div>
      </div>
    </div>
  );
}
