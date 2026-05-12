"use client";
import { useEffect, useState, useCallback } from "react";

interface Bridge {
  id: number;
  name: string;
  serialNo: string | null;
  spans: number | null;
  spanCount: number;
  spanCoefficient: number;
  project: { name: string };
}

interface BridgeEdit {
  spanCount: string;
  spanCoefficient: string;
  dirty: boolean;
}

export default function BridgeSettingsPage() {
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [edits, setEdits] = useState<Record<number, BridgeEdit>>({});
  const [defaultCoef, setDefaultCoef] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/gantt/dashboard?month=2025-04").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([projectsData, settings]) => {
      const all: Bridge[] = Array.isArray(projectsData)
        ? projectsData.flatMap((p: any) =>
            p.bridges.map((b: any) => ({
              id: b.id,
              name: b.name,
              serialNo: b.serialNo,
              spans: b.spans ?? null,
              spanCount: b.spans ?? b.spanCount ?? 1,
              spanCoefficient: b.spanCoefficient ?? 0.5,
              project: { name: p.name },
            }))
          )
        : [];
      setBridges(all);

      const initEdits: Record<number, BridgeEdit> = {};
      for (const b of all) {
        initEdits[b.id] = {
          spanCount: String(b.spanCount),
          spanCoefficient: String(b.spanCoefficient),
          dirty: false,
        };
      }
      setEdits(initEdits);

      if (settings.default_span_coefficient) {
        setDefaultCoef(parseFloat(settings.default_span_coefficient));
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleChange = (id: number, field: "spanCount" | "spanCoefficient", value: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, dirty: true },
    }));
  };

  const handleSave = async (bridge: Bridge) => {
    const edit = edits[bridge.id];
    if (!edit) return;
    setSaving(bridge.id);
    try {
      const res = await fetch(`/api/bridges/${bridge.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spanCount: edit.spanCount,
          spanCoefficient: edit.spanCoefficient,
        }),
      });
      if (res.ok) {
        setEdits((prev) => ({ ...prev, [bridge.id]: { ...prev[bridge.id], dirty: false } }));
        setMsg(`✅ ${bridge.name} を保存しました`);
        setTimeout(() => setMsg(null), 3000);
      }
    } finally {
      setSaving(null);
    }
  };

  const calcHours = (id: number) => {
    const edit = edits[id];
    if (!edit) return "-";
    const sc = parseFloat(edit.spanCount) || 0;
    const coef = parseFloat(edit.spanCoefficient) || defaultCoef;
    return (sc * coef * 8).toFixed(1);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">橋梁別 径間数・係数設定</h1>
      <p className="text-sm text-gray-500 mb-5">
        橋梁ごとに径間数と径間係数を設定します。必要時間 = 径間数 × 係数 × 8時間
      </p>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded text-sm">{msg}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">業務名</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">橋梁名</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">整理番号</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium w-28">径間数</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium w-32">径間係数</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium w-40">必要時間（目安）</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {bridges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">橋梁が登録されていません</td>
                </tr>
              ) : bridges.map((b) => {
                const edit = edits[b.id];
                return (
                  <tr key={b.id} className={`border-b border-gray-100 ${edit?.dirty ? "bg-yellow-50" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-2 text-gray-500 text-xs">{b.project.name}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{b.name}</td>
                    <td className="px-4 py-2 text-gray-500">{b.serialNo ?? "-"}</td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={edit?.spanCount ?? "1"}
                        onChange={(e) => handleChange(b.id, "spanCount", e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-20 text-center"
                      />
                      {b.spans != null && String(b.spans) !== (edit?.spanCount ?? "1") && (
                        <div className="text-xs text-gray-400 mt-0.5">登録値: {b.spans}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={edit?.spanCoefficient ?? "0.5"}
                        onChange={(e) => handleChange(b.id, "spanCoefficient", e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-24 text-center"
                      />
                    </td>
                    <td className="px-4 py-2 text-center text-blue-600 font-medium">
                      {calcHours(b.id)} 時間
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleSave(b)}
                        disabled={!edit?.dirty || saving === b.id}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-30"
                      >
                        {saving === b.id ? "保存中" : "保存"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
