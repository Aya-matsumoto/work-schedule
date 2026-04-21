"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GanttGrid from "@/components/GanttGrid";
import GanttBar from "@/components/GanttBar";
import ProcessEditModal from "@/components/ProcessEditModal";
import ProcessCreateModal from "@/components/ProcessCreateModal";
import BridgeFormModal from "@/components/BridgeFormModal";
import StatusBadge from "@/components/StatusBadge";
import {
  formatDate, getDaysInMonth, currentMonth, prevMonth, nextMonth,
  parseYearMonth, getCurrentProcess, getEffectiveStatus,
} from "@/lib/utils";

interface Staff { id: number; name: string; }

interface ProcessRecord {
  id: number;
  startDate: string | null;
  endDate: string | null;
  completedDate: string | null;
  status: string;
  staffId: number | null;
  note: string | null;
  staff: { id: number; name: string } | null;
  processType: { id: number; name: string; order: number; color: string };
}

interface Bridge {
  id: number;
  name: string;
  serialNo: string | null;
  spans: number | null;
  inspectionDate: string | null;
  processes: ProcessRecord[];
}

interface Project {
  id: number;
  name: string;
  client: string | null;
  deadline: string | null;
  bridges: Bridge[];
}

interface ProcessType {
  id: number;
  name: string;
  color: string;
  order: number;
}

interface EditTarget {
  record: ProcessRecord;
  bridgeName: string;
  projectName: string;
}

interface CreateTarget {
  bridgeId: number;
  bridgeName: string;
  projectName: string;
  initialDate?: string;
}

type SortKey = "default" | "inspectionDate_asc" | "inspectionDate_desc";

export default function DashboardPage() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const [projects, setProjects] = useState<Project[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [view, setView] = useState<"gantt" | "list">("gantt");
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterTypeId, setFilterTypeId] = useState<number | null>(null);
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [showBridgeForm, setShowBridgeForm] = useState(false);

  // リストビュー用
  const [selectedBridgeIds, setSelectedBridgeIds] = useState<Set<number>>(new Set());
  const [searchText, setSearchText] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterProcess, setFilterProcess] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");

  const { year, month: monthNum } = parseYearMonth(month);
  const daysInMonth = getDaysInMonth(year, monthNum);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/gantt/dashboard?month=${month}`).then((r) => r.json()),
      fetch("/api/staff").then((r) => r.json()),
      fetch("/api/process-types").then((r) => r.json()),
    ]).then(([projectsData, staffData, typesData]) => {
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setStaff(Array.isArray(staffData) ? staffData : []);
      setProcessTypes(Array.isArray(typesData) ? [...typesData].sort((a: ProcessType, b: ProcessType) => a.order - b.order) : []);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [month]);

  useEffect(() => { loadData(); }, [loadData]);

  // ロード後、選択中プロジェクトが未設定なら先頭を選択
  useEffect(() => {
    if (projects.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  // ─── ガントチャート用ハンドラー ──────────────────────────────────

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>, bridge: Bridge, projectName: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const dayFraction = relativeX / rect.width;
    const dayIndex = Math.floor(dayFraction * daysInMonth);
    const clickedDate = new Date(year, monthNum - 1, dayIndex + 1);
    const yyyy = clickedDate.getFullYear();
    const mm = String(clickedDate.getMonth() + 1).padStart(2, "0");
    const dd = String(clickedDate.getDate()).padStart(2, "0");
    setCreateTarget({ bridgeId: bridge.id, bridgeName: bridge.name, projectName, initialDate: `${yyyy}-${mm}-${dd}` });
  }, [year, monthNum, daysInMonth]);

  const handleCreateSave = useCallback(async (data: {
    bridgeId: number; processTypeId: number; staffId: number | null;
    startDate: string | null; endDate: string | null; note: string | null;
  }) => {
    setSaving(true);
    try {
      await fetch(`/api/bridges/${data.bridgeId}/processes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processTypeId: data.processTypeId, staffId: data.staffId, startDate: data.startDate, endDate: data.endDate, note: data.note }),
      });
      setCreateTarget(null);
      loadData();
    } finally { setSaving(false); }
  }, [loadData]);

  const handleBarClick = useCallback((recordId: number, bridge: Bridge, projectName: string) => {
    const record = bridge.processes.find((p) => p.id === recordId);
    if (!record) return;
    setEditTarget({ record, bridgeName: bridge.name, projectName });
  }, []);

  const handleDragEnd = useCallback(async (recordId: number, newStart: string, newEnd: string) => {
    setSaving(true);
    try {
      const allRecords = projects.flatMap((p) => p.bridges.flatMap((b) => b.processes));
      const rec = allRecords.find((r) => r.id === recordId);
      await fetch(`/api/processes/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: rec?.staffId ?? null, startDate: newStart, endDate: newEnd, completedDate: rec?.completedDate ?? null, note: rec?.note ?? null, status: rec?.status ?? "IN_PROGRESS" }),
      });
      loadData();
    } finally { setSaving(false); }
  }, [projects, loadData]);

  // 橋梁を追加
  const handleBridgeAdd = useCallback(async (data: { name: string; serialNo: string; spans: string }) => {
    if (!selectedProjectId) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${selectedProjectId}/bridges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setShowBridgeForm(false);
      loadData();
    } finally { setSaving(false); }
  }, [selectedProjectId, loadData]);

  // 橋梁を削除（単体）
  const handleBridgeDelete = useCallback(async (bridgeId: number, bridgeName: string) => {
    if (!confirm(`「${bridgeName}」を削除しますか？\n（この橋梁の工程データもすべて削除されます）`)) return;
    setSaving(true);
    try {
      await fetch(`/api/bridges/${bridgeId}`, { method: "DELETE" });
      loadData();
    } finally { setSaving(false); }
  }, [loadData]);

  // 橋梁を一括削除
  const handleBridgeBulkDelete = useCallback(async () => {
    if (selectedBridgeIds.size === 0) return;
    if (!confirm(`選択した ${selectedBridgeIds.size} 件の橋梁を削除しますか？\n（工程データもすべて削除されます）`)) return;
    setSaving(true);
    try {
      await Promise.all(
        [...selectedBridgeIds].map((id) => fetch(`/api/bridges/${id}`, { method: "DELETE" }))
      );
      setSelectedBridgeIds(new Set());
      loadData();
    } finally { setSaving(false); }
  }, [selectedBridgeIds, loadData]);

  const handleModalSave = useCallback(async (data: {
    id: number; staffId: number | null; startDate: string | null;
    endDate: string | null; completedDate: string | null; note: string | null;
  }) => {
    setSaving(true);
    try {
      let status = "NOT_STARTED";
      if (data.completedDate) status = "COMPLETED";
      else if (data.startDate) status = "IN_PROGRESS";
      await fetch(`/api/processes/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, status }),
      });
      setEditTarget(null);
      loadData();
    } finally { setSaving(false); }
  }, [loadData]);

  // ─── リストビュー用 ────────────────────────────────────────────

  const bridges = selectedProject?.bridges ?? [];

  const staffNames = [...new Set(bridges.flatMap((b) => b.processes.map((p) => p.staff?.name)).filter(Boolean))] as string[];
  const processNames = [...new Set(bridges.flatMap((b) => b.processes.map((p) => p.processType.name)))];

  const filteredBridges = bridges.filter((bridge) => {
    if (searchText && !bridge.name.includes(searchText) && !(bridge.serialNo ?? "").includes(searchText)) return false;
    const currentProcessName = getCurrentProcess(bridge.processes);
    if (filterProcess && currentProcessName !== filterProcess) return false;
    if (filterStaff) {
      if (!bridge.processes.some((p) => p.staff?.name === filterStaff)) return false;
    }
    if (filterStatus) {
      const overallStatus = calcOverallStatus(bridge.processes);
      if (overallStatus !== filterStatus) return false;
    }
    return true;
  });

  const sortedBridges = [...filteredBridges].sort((a, b) => {
    if (sortKey === "default") return 0;
    const da = a.inspectionDate ? new Date(a.inspectionDate).getTime() : null;
    const db = b.inspectionDate ? new Date(b.inspectionDate).getTime() : null;
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return sortKey === "inspectionDate_asc" ? da - db : db - da;
  });

  const nextSortKey = (col: "inspectionDate"): SortKey => {
    if (sortKey === `${col}_asc`) return `${col}_desc`;
    if (sortKey === `${col}_desc`) return "default";
    return `${col}_asc`;
  };
  const sortIcon = (col: "inspectionDate") => {
    if (sortKey === `${col}_asc`) return " ▲";
    if (sortKey === `${col}_desc`) return " ▼";
    return " ↕";
  };

  // ─── レンダー ────────────────────────────────────────────────────

  return (
    <div>
      {/* ヘッダー行 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">工程予定表</h1>
        <Link href="/settings" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          ＋ 業務・橋梁を追加
        </Link>
      </div>

      {/* 業務プルダウン + ビュー切り替え */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 font-medium">業務：</label>
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm min-w-48 bg-white"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.client ? `（${p.client}）` : ""}　{p.bridges.length}橋
              </option>
            ))}
          </select>
          {selectedProject?.deadline && (
            <span className="text-xs text-gray-400">期限：{formatDate(selectedProject.deadline)}</span>
          )}
        </div>

        {/* ガント / リスト 切り替え */}
        <div className="ml-auto flex items-center border border-gray-300 rounded overflow-hidden">
          <button
            onClick={() => setView("gantt")}
            className={`px-4 py-1.5 text-sm transition-colors ${view === "gantt" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            📊 ガントチャート
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-4 py-1.5 text-sm transition-colors border-l border-gray-300 ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            📋 リスト
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-400">読み込み中...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">業務がまだ登録されていません</p>
          <Link href="/settings" className="mt-3 inline-block text-blue-600 hover:underline">マスタ管理へ →</Link>
        </div>
      ) : view === "gantt" ? (
        /* ═══════════════ ガントチャートビュー ═══════════════ */
        <div>
          {/* 月ナビ + 工程フィルター凡例 */}
          <div className="flex flex-wrap items-start gap-4 mb-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setMonth(prevMonth(month))} className="border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-50">← 前月</button>
              <button onClick={() => setMonth(currentMonth())} className="border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-50 text-blue-600 font-medium">今月</button>
              <span className="font-bold text-gray-700 text-lg">{year}年{monthNum}月</span>
              <button onClick={() => setMonth(nextMonth(month))} className="border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-50">翌月 →</button>
              {saving && <span className="text-xs text-gray-400 ml-2">保存中...</span>}
            </div>
            <div className="ml-auto bg-white border border-gray-200 rounded-lg px-3 py-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                onClick={() => setFilterTypeId(null)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${filterTypeId === null ? "bg-gray-700 text-white border-gray-700" : "border-gray-300 text-gray-500 hover:bg-gray-50"}`}
              >
                全工程
              </button>
              {processTypes.map((pt) => (
                <button
                  key={pt.id}
                  onClick={() => setFilterTypeId(filterTypeId === pt.id ? null : pt.id)}
                  className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border transition-colors ${filterTypeId === pt.id ? "border-current font-semibold" : "border-transparent hover:border-gray-200"}`}
                  style={filterTypeId === pt.id ? { color: pt.color, borderColor: pt.color, backgroundColor: pt.color + "18" } : {}}
                >
                  <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: pt.color }} />
                  <span className="text-gray-700">{pt.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ガントチャート本体 */}
          {!selectedProject ? (
            <div className="py-8 text-center text-gray-400">業務を選択してください</div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {selectedProject.bridges.length === 0 && (
                <div className="px-4 py-6 text-center text-gray-400 text-sm border-b border-gray-100">橋梁が登録されていません</div>
              )}
              {selectedProject.bridges.map((bridge) => (
                <div key={bridge.id} className="flex items-stretch border-b border-gray-100 last:border-0 group">
                  <div className="flex items-center flex-shrink-0" style={{ width: 220 }}>
                    <button
                      onClick={() => router.push(`/bridges/${bridge.id}`)}
                      className="flex-1 flex items-center px-4 py-2 text-left hover:bg-blue-50 transition-colors min-w-0 h-full"
                    >
                      <div className="min-w-0">
                        <div className="text-gray-700 font-medium text-sm truncate">{bridge.name}</div>
                        {bridge.serialNo && <div className="text-xs text-gray-400">{bridge.serialNo}</div>}
                      </div>
                    </button>
                    <button
                      onClick={() => handleBridgeDelete(bridge.id, bridge.name)}
                      className="opacity-0 group-hover:opacity-100 px-2 text-gray-300 hover:text-red-500 transition-all flex-shrink-0"
                      title="この橋梁を削除"
                    >
                      🗑
                    </button>
                  </div>
                  <div className="flex-1 border-l border-gray-100 min-w-0">
                    <GanttGrid year={year} month={monthNum}>
                      <div
                        className="relative cursor-cell"
                        style={{ height: 36 }}
                        onClick={(e) => handleGridClick(e, bridge, selectedProject.name)}
                      >
                        {bridge.processes
                          .filter((proc) => filterTypeId === null || proc.processType.id === filterTypeId)
                          .map((proc) => (
                            <GanttBar
                              key={proc.id}
                              id={proc.id}
                              startDate={proc.startDate}
                              endDate={proc.endDate}
                              completedDate={proc.completedDate}
                              color={proc.processType.color}
                              staffName={proc.staff?.name ?? null}
                              processName={proc.processType.name}
                              year={year}
                              month={monthNum}
                              onDragEnd={handleDragEnd}
                              onClick={(rid) => handleBarClick(rid, bridge, selectedProject.name)}
                            />
                          ))}
                      </div>
                    </GanttGrid>
                  </div>
                </div>
              ))}
              {/* ＋橋梁を追加（ガント） */}
              <div className="px-4 py-2 border-t border-gray-100">
                <button
                  onClick={() => setShowBridgeForm(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  ＋ 橋梁を追加
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ═══════════════ リストビュー ═══════════════ */
        <div>
          {/* フィルターバー */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">橋梁名検索</label>
              <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="橋梁名..." className="border border-gray-300 rounded px-3 py-1.5 text-sm w-36" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">担当者</label>
              <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm">
                <option value="">すべて</option>
                {staffNames.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">現在工程</label>
              <select value={filterProcess} onChange={(e) => setFilterProcess(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm">
                <option value="">すべて</option>
                {processNames.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ステータス</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm">
                <option value="">すべて</option>
                <option value="NOT_STARTED">未着手</option>
                <option value="IN_PROGRESS">作業中</option>
                <option value="COMPLETED">完了</option>
                <option value="DELAYED">遅延</option>
              </select>
            </div>
            {(filterStaff || filterStatus || filterProcess || searchText) && (
              <button onClick={() => { setFilterStaff(""); setFilterStatus(""); setFilterProcess(""); setSearchText(""); }} className="text-sm text-gray-400 hover:text-red-500 underline">クリア</button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-gray-500">{sortedBridges.length}件</span>
              {selectedBridgeIds.size > 0 && (
                <button
                  onClick={handleBridgeBulkDelete}
                  className="bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600"
                >
                  🗑 選択削除（{selectedBridgeIds.size}件）
                </button>
              )}
              <button
                onClick={() => setShowBridgeForm(true)}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
              >
                ＋ 橋梁を追加
              </button>
            </div>
          </div>

          {/* テーブル */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={sortedBridges.length > 0 && sortedBridges.every((b) => selectedBridgeIds.has(b.id))}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedBridgeIds.size > 0 && !sortedBridges.every((b) => selectedBridgeIds.has(b.id));
                      }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBridgeIds(new Set(sortedBridges.map((b) => b.id)));
                        } else {
                          setSelectedBridgeIds(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">整理番号</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">橋梁名</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">径間数</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">現在工程</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">担当者</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">完了予定日</th>
                  <th
                    className="text-left px-4 py-3 text-gray-600 font-medium cursor-pointer hover:text-blue-600 select-none"
                    onClick={() => setSortKey(nextSortKey("inspectionDate"))}
                  >
                    点検完了日{sortIcon("inspectionDate")}
                  </th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">ステータス</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedBridges.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400">該当する橋梁がありません</td></tr>
                ) : sortedBridges.map((bridge) => {
                  const currentProcessName = getCurrentProcess(bridge.processes);
                  const currentRecord = bridge.processes.find((p) => p.processType.name === currentProcessName && !p.completedDate);
                  const overallStatus = calcOverallStatus(bridge.processes);
                  const isChecked = selectedBridgeIds.has(bridge.id);
                  return (
                    <tr
                      key={bridge.id}
                      className={`border-b border-gray-100 cursor-pointer group ${isChecked ? "bg-blue-50" : "hover:bg-gray-50"}`}
                      onClick={() => router.push(`/bridges/${bridge.id}`)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = new Set(selectedBridgeIds);
                            e.target.checked ? next.add(bridge.id) : next.delete(bridge.id);
                            setSelectedBridgeIds(next);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{bridge.serialNo ?? "-"}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{bridge.name}</td>
                      <td className="px-4 py-3 text-gray-600 text-center">{bridge.spans ?? "-"}</td>
                      <td className="px-4 py-3">{currentProcessName}</td>
                      <td className="px-4 py-3 text-gray-600">{currentRecord?.staff?.name ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{currentRecord?.endDate ? formatDate(currentRecord.endDate) : "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{bridge.inspectionDate ? formatDate(bridge.inspectionDate) : "-"}</td>
                      <td className="px-4 py-3"><StatusBadge status={overallStatus} /></td>
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBridgeDelete(bridge.id, bridge.name); }}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-base px-1"
                          title="この橋梁を削除"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editTarget && (
        <ProcessEditModal
          record={editTarget.record}
          staff={staff}
          bridgeName={editTarget.bridgeName}
          projectName={editTarget.projectName}
          onSave={handleModalSave}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* 橋梁追加モーダル */}
      {showBridgeForm && selectedProject && (
        <BridgeFormModal
          projectName={selectedProject.name}
          onSave={handleBridgeAdd}
          onClose={() => setShowBridgeForm(false)}
        />
      )}

      {/* 新規登録モーダル */}
      {createTarget && (
        <ProcessCreateModal
          bridgeId={createTarget.bridgeId}
          bridgeName={createTarget.bridgeName}
          projectName={createTarget.projectName}
          staff={staff}
          processTypes={processTypes}
          initialDate={createTarget.initialDate}
          onSave={handleCreateSave}
          onClose={() => setCreateTarget(null)}
        />
      )}
    </div>
  );
}

// 橋梁全体のステータスを計算
function calcOverallStatus(processes: ProcessRecord[]): string {
  if (processes.length === 0) return "NOT_STARTED";
  if (processes.some((p) => getEffectiveStatus(p) === "DELAYED")) return "DELAYED";
  if (processes.every((p) => p.completedDate)) return "COMPLETED";
  if (processes.some((p) => p.startDate)) return "IN_PROGRESS";
  return "NOT_STARTED";
}
