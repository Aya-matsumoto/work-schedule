"use client";
import { useState } from "react";

interface Props {
  projectName: string;
  onSave: (data: { name: string; serialNo: string; spans: string }) => void;
  onClose: () => void;
}

export default function BridgeFormModal({ projectName, onSave, onClose }: Props) {
  const [form, setForm] = useState({ name: "", serialNo: "", spans: "" });
  const [error, setError] = useState("");

  const handleSave = () => {
    if (!form.name.trim()) { setError("橋梁名を入力してください"); return; }
    onSave(form);
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
            <div className="font-bold text-gray-800 text-sm">橋梁を追加</div>
            <p className="text-xs text-gray-400 mt-0.5">{projectName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* フォーム */}
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">橋梁名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setError(""); }}
              placeholder="例：○○橋"
              className={`border rounded px-3 py-1.5 text-sm w-full ${error ? "border-red-400" : "border-gray-300"}`}
              autoFocus
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">整理番号</label>
            <input
              type="text"
              value={form.serialNo}
              onChange={(e) => setForm((f) => ({ ...f, serialNo: e.target.value }))}
              placeholder="例：001"
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">径間数</label>
            <input
              type="number"
              value={form.spans}
              onChange={(e) => setForm((f) => ({ ...f, spans: e.target.value }))}
              placeholder="任意"
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-24"
            />
          </div>
        </div>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50">
            キャンセル
          </button>
          <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
