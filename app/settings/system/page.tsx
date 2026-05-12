"use client";
import { useEffect, useState } from "react";

export default function SystemSettingsPage() {
  const [spanCoef, setSpanCoef] = useState("0.5");
  const [fyMonth, setFyMonth] = useState("4");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.default_span_coefficient) setSpanCoef(data.default_span_coefficient);
        if (data.fiscal_year_start_month) setFyMonth(data.fiscal_year_start_month);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            default_span_coefficient: spanCoef,
            fiscal_year_start_month: fyMonth,
          },
        }),
      });
      if (res.ok) setMsg({ type: "success", text: "✅ 保存しました" });
      else setMsg({ type: "error", text: "❌ 保存に失敗しました" });
    } catch {
      setMsg({ type: "error", text: "❌ 通信エラーが発生しました" });
    } finally {
      setSaving(false);
    }
  };

  const previewHours = (parseFloat(spanCoef) * 8).toFixed(1);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">システム設定</h1>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded text-sm ${msg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">

          {/* 径間係数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              径間係数のデフォルト値
            </label>
            <p className="text-xs text-gray-400 mb-2">
              1径間あたりの作業日数（例：0.5 = 半日4時間 / 1.0 = 1日8時間）
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5"
                value={spanCoef}
                onChange={(e) => setSpanCoef(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-28"
              />
              <span className="text-sm text-gray-500">
                日/径間 = <strong>{previewHours}</strong> 時間/径間
              </span>
            </div>
            <div className="mt-2 text-xs text-gray-400 space-y-0.5">
              <div>例）径間数4の橋梁 → 必要時間 = 4 × {spanCoef} × 8 = <strong>{(4 * parseFloat(spanCoef) * 8).toFixed(1)}</strong> 時間</div>
              <div>　　8時間/日の担当者が担当 → <strong>{Math.ceil(4 * parseFloat(spanCoef) * 8 / 8)}</strong> 日</div>
            </div>
          </div>

          {/* 年度開始月 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              年度開始月
            </label>
            <p className="text-xs text-gray-400 mb-2">
              自動割り振りの対象期間に使用します（通常は4月）
            </p>
            <select
              value={fyMonth}
              onChange={(e) => setFyMonth(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-28"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
