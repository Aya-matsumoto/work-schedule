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
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleProject = (name: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

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
    <div className="d3-body">
      <div className="d3-headrow">
        <div>
          <h1 className="d3-h1">橋梁別 径間数・<span className="em">係数設定</span></h1>
          <div className="d3-hsub">橋梁ごとに径間数と径間係数を設定します。必要時間 = 径間数 × 係数 × 8時間</div>
        </div>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded text-sm">{msg}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-400">読み込み中...</div>
      ) : bridges.length === 0 ? (
        <div className="py-8 text-center text-gray-400">橋梁が登録されていません</div>
      ) : (
        <div className="space-y-5">
          {/* 業務名ごとにグループ化 */}
          {Array.from(new Map(bridges.map((b) => [b.project.name, true])).keys()).map((projectName) => {
            const groupBridges = bridges.filter((b) => b.project.name === projectName);
            const isOpen = expandedProjects.has(projectName);
            const hasDirty = groupBridges.some((b) => edits[b.id]?.dirty);
            return (
              <div key={projectName} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* アコーディオンヘッダー */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleProject(projectName)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm" style={{ color: "var(--ink)" }}>{projectName}</span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>{groupBridges.length}橋梁</span>
                    {hasDirty && (
                      <span className="text-xs font-medium" style={{ color: "#B45309" }}>● 未保存あり</span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {/* アコーディオン本体 */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-100" style={{ background: "var(--surface)" }}>
                        <tr>
                          <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--muted)", fontSize: 12 }}>橋梁名</th>
                          <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--muted)", fontSize: 12 }}>整理番号</th>
                          <th className="text-center px-4 py-2 font-medium w-28" style={{ color: "var(--muted)", fontSize: 12 }}>径間数</th>
                          <th className="text-center px-4 py-2 font-medium w-32" style={{ color: "var(--muted)", fontSize: 12 }}>径間係数</th>
                          <th className="text-center px-4 py-2 font-medium w-40" style={{ color: "var(--muted)", fontSize: 12 }}>必要時間（目安）</th>
                          <th className="px-4 py-2 w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupBridges.map((b) => {
                          const edit = edits[b.id];
                          return (
                            <tr key={b.id} className={`border-b border-gray-100 ${edit?.dirty ? "bg-yellow-50" : "hover:bg-gray-50"}`}>
                              <td className="px-4 py-2 font-medium" style={{ color: "var(--ink)" }}>{b.name}</td>
                              <td className="px-4 py-2" style={{ color: "var(--muted)" }}>{b.serialNo ?? "-"}</td>
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
                              <td className="px-4 py-2 text-center font-medium" style={{ color: "var(--g1)" }}>
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
          })}
        </div>
      )}
    </div>
  );
}
