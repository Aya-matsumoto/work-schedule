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

interface ProcessType {
  id: number;
  name: string;
  color: string;
  order: number;
}

interface ConfigEdit {
  spanCount: string;
  spanCoefficient: string;
  requiredHours: string; // 空文字 = 自動算出
  dirty: boolean;
}

const TARGET_PT_NAMES = ["調書作成", "チェック", "修正"];

export default function BridgeSettingsPage() {
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [selectedPtId, setSelectedPtId] = useState<number | null>(null);
  const [configs, setConfigs] = useState<Record<string, ConfigEdit>>({});
  const [defaultCoef, setDefaultCoef] = useState(4);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleProject = (name: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [projectsData, settings, ptsData, cfgData] = await Promise.all([
      fetch("/api/gantt/dashboard?month=2025-04").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/process-types").then((r) => r.json()),
      fetch("/api/bridge-process-configs").then((r) => r.json()),
    ]);

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

    const pts: ProcessType[] = Array.isArray(ptsData)
      ? ptsData.filter((pt: any) => TARGET_PT_NAMES.includes(pt.name)).sort((a: any, b: any) => a.order - b.order)
      : [];
    setProcessTypes(pts);
    if (pts.length > 0 && selectedPtId === null) setSelectedPtId(pts[0].id);

    if (settings.default_span_coefficient) setDefaultCoef(parseFloat(settings.default_span_coefficient));

    const cfgMap: Record<string, any> = {};
    if (Array.isArray(cfgData)) {
      for (const c of cfgData) cfgMap[`${c.bridgeId}-${c.processTypeId}`] = c;
    }

    const editMap: Record<string, ConfigEdit> = {};
    for (const b of all) {
      for (const pt of pts) {
        const key = `${b.id}-${pt.id}`;
        const cfg = cfgMap[key];
        editMap[key] = {
          spanCount: cfg?.spanCount != null ? String(cfg.spanCount) : String(b.spanCount),
          spanCoefficient: cfg?.spanCoefficient != null ? String(cfg.spanCoefficient) : String(b.spanCoefficient),
          requiredHours: cfg?.requiredHours != null ? String(cfg.requiredHours) : "",
          dirty: false,
        };
      }
    }
    setConfigs(editMap);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleChange = (bridgeId: number, ptId: number, field: keyof ConfigEdit, value: string) => {
    const key = `${bridgeId}-${ptId}`;
    setConfigs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value, dirty: true } }));
  };

  // 一括自動算出（業務内の全橋梁）
  const handleBatchAutoCalc = (projectName: string) => {
    if (!selectedPtId) return;
    const groupBridges = bridges.filter((b) => b.project.name === projectName);
    setConfigs((prev) => {
      const next = { ...prev };
      for (const b of groupBridges) {
        const key = `${b.id}-${selectedPtId}`;
        const cfg = prev[key];
        if (!cfg) continue;
        const sc = parseFloat(cfg.spanCount) || 0;
        const coef = parseFloat(cfg.spanCoefficient) || defaultCoef;
        next[key] = { ...cfg, requiredHours: (sc * coef).toFixed(1), dirty: true };
      }
      return next;
    });
  };

  // 一括保存（業務内の全ダーティ行）
  const handleBatchSave = async (projectName: string) => {
    if (!selectedPtId) return;
    const groupBridges = bridges.filter((b) => b.project.name === projectName);
    const dirty = groupBridges.filter((b) => configs[`${b.id}-${selectedPtId}`]?.dirty);
    if (dirty.length === 0) return;
    setBatchSaving(projectName);
    try {
      await Promise.all(dirty.map((b) => {
        const cfg = configs[`${b.id}-${selectedPtId}`];
        return fetch("/api/bridge-process-configs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bridgeId: b.id,
            processTypeId: selectedPtId,
            spanCount: cfg.spanCount || null,
            spanCoefficient: cfg.spanCoefficient || null,
            requiredHours: cfg.requiredHours || null,
          }),
        });
      }));
      setConfigs((prev) => {
        const next = { ...prev };
        for (const b of dirty) next[`${b.id}-${selectedPtId}`] = { ...next[`${b.id}-${selectedPtId}`], dirty: false };
        return next;
      });
      setMsg(`✅ ${projectName} を一括保存しました（${dirty.length}件）`);
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setBatchSaving(null);
    }
  };

  const handleSave = async (bridge: Bridge, ptId: number) => {
    const key = `${bridge.id}-${ptId}`;
    const cfg = configs[key];
    if (!cfg) return;
    setSaving(key);
    try {
      const res = await fetch("/api/bridge-process-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bridgeId: bridge.id,
          processTypeId: ptId,
          spanCount: cfg.spanCount || null,
          spanCoefficient: cfg.spanCoefficient || null,
          requiredHours: cfg.requiredHours || null,
        }),
      });
      if (res.ok) {
        setConfigs((prev) => ({ ...prev, [key]: { ...prev[key], dirty: false } }));
        setMsg(`✅ ${bridge.name} を保存しました`);
        setTimeout(() => setMsg(null), 3000);
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="d3-body">
      <div className="d3-headrow">
        <div>
          <h1 className="d3-h1">橋梁別 径間数・<span className="em">係数設定</span></h1>
          <div className="d3-hsub">必要時間 = 径間数 × 係数（時間/径間）　または　直接入力。空欄の場合は自動算出。</div>
        </div>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded text-sm">{msg}</div>
      )}

      {/* 工程タブ */}
      <div className="d3-tabs mb-4">
        {processTypes.map((pt) => (
          <button
            key={pt.id}
            onClick={() => setSelectedPtId(pt.id)}
            className={`d3-tab${selectedPtId === pt.id ? " on" : ""}`}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: pt.color, verticalAlign: "middle" }} />
            {pt.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-400">読み込み中...</div>
      ) : bridges.length === 0 ? (
        <div className="py-8 text-center text-gray-400">橋梁が登録されていません</div>
      ) : (
        <div className="space-y-4">
          {Array.from(new Map(bridges.map((b) => [b.project.name, true])).keys()).map((projectName) => {
            const groupBridges = bridges.filter((b) => b.project.name === projectName);
            const isOpen = expandedProjects.has(projectName);
            const hasDirty = selectedPtId
              ? groupBridges.some((b) => configs[`${b.id}-${selectedPtId}`]?.dirty)
              : false;

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

                {isOpen && selectedPtId && (
                  <div className="border-t border-gray-100">
                    {/* 一括操作ツールバー */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs text-gray-500">径間数 × 係数 で全橋梁の必要時間を一括算出します</span>
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={() => handleBatchAutoCalc(projectName)}
                          className="text-xs border border-blue-400 text-blue-600 px-3 py-1 rounded hover:bg-blue-50 font-medium whitespace-nowrap"
                        >
                          一括自動算出
                        </button>
                        <button
                          onClick={() => handleBatchSave(projectName)}
                          disabled={batchSaving === projectName || !groupBridges.some((b) => configs[`${b.id}-${selectedPtId}`]?.dirty)}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-30 font-medium whitespace-nowrap"
                        >
                          {batchSaving === projectName ? "保存中..." : "一括保存"}
                        </button>
                      </div>
                    </div>

                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-100" style={{ background: "var(--surface)" }}>
                        <tr>
                          <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--muted)", fontSize: 12 }}>橋梁名</th>
                          <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--muted)", fontSize: 12 }}>整理番号</th>
                          <th className="text-center px-4 py-2 font-medium w-24" style={{ color: "var(--muted)", fontSize: 12 }}>径間数</th>
                          <th className="text-center px-4 py-2 font-medium w-28" style={{ color: "var(--muted)", fontSize: 12 }}>径間係数</th>
                          <th className="text-center px-4 py-2 font-medium w-40" style={{ color: "var(--muted)", fontSize: 12 }}>
                            必要時間
                            <span className="ml-1 font-normal" style={{ color: "var(--muted)", fontSize: 11 }}>(空欄=自動)</span>
                          </th>
                          <th className="px-4 py-2 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupBridges.map((b) => {
                          const key = `${b.id}-${selectedPtId}`;
                          const cfg = configs[key];
                          return (
                            <tr key={b.id} className={`border-b border-gray-100 ${cfg?.dirty ? "bg-yellow-50" : "hover:bg-gray-50"}`}>
                              <td className="px-4 py-2 font-medium" style={{ color: "var(--ink)" }}>{b.name}</td>
                              <td className="px-4 py-2" style={{ color: "var(--muted)" }}>{b.serialNo ?? "-"}</td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="number" min="1" step="1"
                                  value={cfg?.spanCount ?? ""}
                                  onChange={(e) => handleChange(b.id, selectedPtId, "spanCount", e.target.value)}
                                  className="border border-gray-300 rounded px-2 py-1 text-sm w-20 text-center"
                                />
                              </td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="number" min="0.5" step="0.5"
                                  value={cfg?.spanCoefficient ?? ""}
                                  onChange={(e) => handleChange(b.id, selectedPtId, "spanCoefficient", e.target.value)}
                                  className="border border-gray-300 rounded px-2 py-1 text-sm w-24 text-center"
                                />
                              </td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="number" min="0" step="0.5"
                                  value={cfg?.requiredHours ?? ""}
                                  onChange={(e) => handleChange(b.id, selectedPtId, "requiredHours", e.target.value)}
                                  placeholder="自動"
                                  className="border border-gray-300 rounded px-2 py-1 text-sm w-28 text-center"
                                />
                              </td>
                              <td className="px-4 py-2 text-right">
                                <button
                                  onClick={() => handleSave(b, selectedPtId)}
                                  disabled={!cfg?.dirty || saving === key}
                                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-30"
                                >
                                  {saving === key ? "保存中" : "保存"}
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
