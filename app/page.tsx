"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GanttGrid from "@/components/GanttGrid";
import GanttBar from "@/components/GanttBar";
import ProcessEditModal from "@/components/ProcessEditModal";
import ProcessCreateModal from "@/components/ProcessCreateModal";
import BridgeFormModal from "@/components/BridgeFormModal";
import AssignmentEditModal from "@/components/AssignmentEditModal";
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
  staffMembers?: { staffId: number; staff: { id: number; name: string } }[];
  processType: { id: number; name: string; order: number; color: string };
}

interface BridgeAssignment {
  id: number;
  staffId: number;
  startDate: string | null;
  endDate: string | null;
  isManual: boolean;
  staff: { id: number; name: string; color: string };
}

interface Bridge {
  id: number;
  name: string;
  serialNo: string | null;
  spans: number | null;
  inspectionDate: string | null;
  processes: ProcessRecord[];
  assignments: BridgeAssignment[];
}

interface Project {
  id: number;
  name: string;
  client: string | null;
  deadline: string | null;
  bridges: Bridge[];
  processes: ProcessRecord[];
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

interface AssignmentEditTarget {
  assignment: BridgeAssignment;
  bridgeName: string;
  projectName: string;
}

interface CreateTarget {
  projectId: number;
  projectName: string;
  bridgeId?: number;
  bridgeName?: string;
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
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<number>>(new Set());
  const [view, setView] = useState<"gantt" | "list">("gantt");
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [assignmentEditTarget, setAssignmentEditTarget] = useState<AssignmentEditTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterTypeId, setFilterTypeId] = useState<number | null>(null);
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [addBridgeProjectId, setAddBridgeProjectId] = useState<number | null>(null);

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
    }).catch(() => setLoading(false));
  }, [month]);

  useEffect(() => { loadData(); }, [loadData]);

  // プロジェクトロード後、全て展開
  useEffect(() => {
    if (projects.length > 0) {
      setExpandedProjectIds((prev) => {
        const next = new Set(prev);
        projects.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }, [projects]);

  // アコーディオン開閉
  const toggleProject = useCallback((projectId: number) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  // ─── ガントチャート用ハンドラー ──────────────────────────────────

  const handleGridClick = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    context: { projectId: number; projectName: string; bridgeId?: number; bridgeName?: string }
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const dayFraction = relativeX / rect.width;
    const dayIndex = Math.floor(dayFraction * daysInMonth);
    const clickedDate = new Date(year, monthNum - 1, dayIndex + 1);
    const yyyy = clickedDate.getFullYear();
    const mm = String(clickedDate.getMonth() + 1).padStart(2, "0");
    const dd = String(clickedDate.getDate()).padStart(2, "0");
    setCreateTarget({ ...context, initialDate: `${yyyy}-${mm}-${dd}` });
  }, [year, monthNum, daysInMonth]);

  const handleCreateSave = useCallback(async (data: {
    projectId: number;
    bridgeId?: number;
    processTypeId: number;
    staffIds: number[];
    startDate: string | null;
    endDate: string | null;
    note: string | null;
  }) => {
    const tempId = -Date.now();
    const processType = processTypes.find((pt) => pt.id === data.processTypeId)!;
    const primaryStaffId = data.staffIds[0] ?? null;
    const staffMember = staff.find((s) => s.id === primaryStaffId) ?? null;
    const staffMembersTemp = data.staffIds.map((sid) => ({
      staffId: sid,
      staff: staff.find((s) => s.id === sid) ?? { id: sid, name: "" },
    }));
    const tempRecord: ProcessRecord = {
      id: tempId,
      startDate: data.startDate,
      endDate: data.endDate,
      completedDate: null,
      status: data.startDate ? "IN_PROGRESS" : "NOT_STARTED",
      staffId: primaryStaffId,
      note: data.note,
      staff: staffMember,
      staffMembers: staffMembersTemp,
      processType,
    };

    // 即座に画面に追加
    if (data.bridgeId) {
      setProjects((prev) => prev.map((p) => ({
        ...p,
        bridges: p.bridges.map((b) =>
          b.id === data.bridgeId ? { ...b, processes: [...b.processes, tempRecord] } : b
        ),
      })));
    } else {
      setProjects((prev) => prev.map((p) =>
        p.id === data.projectId ? { ...p, processes: [...p.processes, tempRecord] } : p
      ));
    }
    setCreateTarget(null);

    // バックグラウンドで保存
    try {
      const url = data.bridgeId
        ? `/api/bridges/${data.bridgeId}/processes`
        : `/api/projects/${data.projectId}/processes`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processTypeId: data.processTypeId, staffIds: data.staffIds, startDate: data.startDate, endDate: data.endDate, note: data.note }),
      });
      const created = await res.json();
      // 仮IDを本物のIDに差し替え
      if (data.bridgeId) {
        setProjects((prev) => prev.map((p) => ({
          ...p,
          bridges: p.bridges.map((b) => ({
            ...b,
            processes: b.processes.map((proc) => proc.id === tempId ? { ...proc, id: created.id } : proc),
          })),
        })));
      } else {
        setProjects((prev) => prev.map((p) => ({
          ...p,
          processes: p.id === data.projectId
            ? p.processes.map((proc) => proc.id === tempId ? { ...proc, id: created.id } : proc)
            : p.processes,
        })));
      }
    } catch { loadData(); }
  }, [processTypes, staff, loadData]);

  const handleBarClick = useCallback((recordId: number, processes: ProcessRecord[], projectName: string, bridgeName: string) => {
    const record = processes.find((p) => p.id === recordId);
    if (!record) return;
    setEditTarget({ record, bridgeName, projectName });
  }, []);

  // 自動割り振りバー クリック → 編集モーダル
  const handleAssignmentBarClick = useCallback((
    assignmentId: number,
    bridge: Bridge,
    projectName: string
  ) => {
    const assignment = bridge.assignments?.find((a) => a.id === assignmentId);
    if (!assignment) return;
    setAssignmentEditTarget({ assignment, bridgeName: bridge.name, projectName });
  }, []);

  // 自動割り振りバー ドラッグ → 日程更新
  const handleAssignmentDragEnd = useCallback(async (assignmentId: number, newStart: string, newEnd: string) => {
    setSaving(true);
    setProjects((prev) => prev.map((p) => ({
      ...p,
      bridges: p.bridges.map((b) => ({
        ...b,
        assignments: b.assignments?.map((a) =>
          a.id === assignmentId ? { ...a, startDate: newStart, endDate: newEnd, isManual: true } : a
        ),
      })),
    })));
    try {
      await fetch(`/api/assignments/${assignmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: newStart, endDate: newEnd }),
      });
    } catch { loadData(); }
    finally { setSaving(false); }
  }, [loadData]);

  // 割り振り編集モーダル 保存
  const handleAssignmentSave = useCallback(async (data: {
    id: number;
    staffId: number;
    startDate: string | null;
    endDate: string | null;
  }) => {
    const staffMember = staff.find((s) => s.id === data.staffId);
    setProjects((prev) => prev.map((p) => ({
      ...p,
      bridges: p.bridges.map((b) => ({
        ...b,
        assignments: b.assignments?.map((a) =>
          a.id === data.id
            ? { ...a, ...data, isManual: true, staff: staffMember ? { ...staffMember, color: a.staff.color } : a.staff }
            : a
        ),
      })),
    })));
    setAssignmentEditTarget(null);
    try {
      await fetch(`/api/assignments/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: data.staffId, startDate: data.startDate, endDate: data.endDate }),
      });
    } catch { loadData(); }
  }, [staff, loadData]);

  // 割り振り編集モーダル 削除
  const handleAssignmentDelete = useCallback(async (assignmentId: number) => {
    setProjects((prev) => prev.map((p) => ({
      ...p,
      bridges: p.bridges.map((b) => ({
        ...b,
        assignments: b.assignments?.filter((a) => a.id !== assignmentId),
      })),
    })));
    setAssignmentEditTarget(null);
    try {
      await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
    } catch { loadData(); }
  }, [loadData]);

  const handleDragEnd = useCallback(async (recordId: number, newStart: string, newEnd: string) => {
    setSaving(true);
    setProjects((prev) => prev.map((p) => ({
      ...p,
      processes: p.processes.map((proc) => proc.id === recordId ? { ...proc, startDate: newStart, endDate: newEnd } : proc),
      bridges: p.bridges.map((b) => ({
        ...b,
        processes: b.processes.map((proc) => proc.id === recordId ? { ...proc, startDate: newStart, endDate: newEnd } : proc),
      })),
    })));
    try {
      const allRecords = projects.flatMap((p) => [
        ...p.processes,
        ...p.bridges.flatMap((b) => b.processes),
      ]);
      const rec = allRecords.find((r) => r.id === recordId);
      await fetch(`/api/processes/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: rec?.staffId ?? null, startDate: newStart, endDate: newEnd, completedDate: rec?.completedDate ?? null, note: rec?.note ?? null, status: rec?.status ?? "IN_PROGRESS" }),
      });
    } catch { loadData(); }
    finally { setSaving(false); }
  }, [projects, loadData]);

  // 橋梁を追加
  const handleBridgeAdd = useCallback(async (data: { name: string; serialNo: string; spans: string }) => {
    if (!addBridgeProjectId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${addBridgeProjectId}/bridges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const newBridge = await res.json();
      setProjects((prev) => prev.map((p) =>
        p.id === addBridgeProjectId
          ? { ...p, bridges: [...p.bridges, { ...newBridge, processes: [] }] }
          : p
      ));
      setAddBridgeProjectId(null);
    } finally { setSaving(false); }
  }, [addBridgeProjectId]);

  // 橋梁を削除（単体）
  const handleBridgeDelete = useCallback(async (bridgeId: number, bridgeName: string) => {
    if (!confirm(`「${bridgeName}」を削除しますか？\n（この橋梁の工程データもすべて削除されます）`)) return;
    setProjects((prev) => prev.map((p) => ({
      ...p,
      bridges: p.bridges.filter((b) => b.id !== bridgeId),
    })));
    try {
      await fetch(`/api/bridges/${bridgeId}`, { method: "DELETE" });
    } catch { loadData(); }
  }, [loadData]);

  // 橋梁を一括削除
  const handleBridgeBulkDelete = useCallback(async () => {
    if (selectedBridgeIds.size === 0) return;
    if (!confirm(`選択した ${selectedBridgeIds.size} 件の橋梁を削除しますか？\n（工程データもすべて削除されます）`)) return;
    const idsToDelete = [...selectedBridgeIds];
    setProjects((prev) => prev.map((p) => ({
      ...p,
      bridges: p.bridges.filter((b) => !idsToDelete.includes(b.id)),
    })));
    setSelectedBridgeIds(new Set());
    try {
      await Promise.all(idsToDelete.map((id) => fetch(`/api/bridges/${id}`, { method: "DELETE" })));
    } catch { loadData(); }
  }, [selectedBridgeIds, loadData]);

  const handleModalSave = useCallback(async (data: {
    id: number; staffIds: number[]; startDate: string | null;
    endDate: string | null; completedDate: string | null; note: string | null;
  }) => {
    let status = "NOT_STARTED";
    if (data.completedDate) status = "COMPLETED";
    else if (data.startDate) status = "IN_PROGRESS";
    const primaryStaffId = data.staffIds[0] ?? null;
    const staffMember = staff.find((s) => s.id === primaryStaffId) ?? null;
    const staffMembersUpdated = data.staffIds.map((sid) => ({
      staffId: sid,
      staff: staff.find((s) => s.id === sid) ?? { id: sid, name: "" },
    }));
    setProjects((prev) => prev.map((p) => ({
      ...p,
      processes: p.processes.map((proc) =>
        proc.id === data.id
          ? { ...proc, ...data, staffId: primaryStaffId, status, staff: staffMember, staffMembers: staffMembersUpdated }
          : proc
      ),
      bridges: p.bridges.map((b) => ({
        ...b,
        processes: b.processes.map((proc) =>
          proc.id === data.id
            ? { ...proc, ...data, staffId: primaryStaffId, status, staff: staffMember, staffMembers: staffMembersUpdated }
            : proc
        ),
      })),
    })));
    setEditTarget(null);
    try {
      await fetch(`/api/processes/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffIds: data.staffIds, startDate: data.startDate, endDate: data.endDate, completedDate: data.completedDate, note: data.note, status }),
      });
    } catch { loadData(); }
  }, [staff, loadData]);

  const handleProcessDelete = useCallback(async (processId: number) => {
    setProjects((prev) => prev.map((p) => ({
      ...p,
      processes: p.processes.filter((proc) => proc.id !== processId),
      bridges: p.bridges.map((b) => ({
        ...b,
        processes: b.processes.filter((proc) => proc.id !== processId),
      })),
    })));
    setEditTarget(null);
    try {
      await fetch(`/api/processes/${processId}`, { method: "DELETE" });
    } catch { loadData(); }
  }, [loadData]);

  // ─── リストビュー用（全業務の橋梁をフラットに） ──────────────────

  type BridgeRow = Bridge & { projectName: string; projectId: number };
  const allBridges: BridgeRow[] = projects.flatMap((p) =>
    p.bridges.map((b) => ({ ...b, projectName: p.name, projectId: p.id }))
  );
  const staffNames = [...new Set(allBridges.flatMap((b) => b.processes.map((p) => p.staff?.name)).filter(Boolean))] as string[];
  const processNames = [...new Set(allBridges.flatMap((b) => b.processes.map((p) => p.processType.name)))];

  const filteredBridges = allBridges.filter((bridge) => {
    if (searchText && !bridge.name.includes(searchText) && !(bridge.serialNo ?? "").includes(searchText) && !bridge.projectName.includes(searchText)) return false;
    const currentProcessName = getCurrentProcess(bridge.processes);
    if (filterProcess && currentProcessName !== filterProcess) return false;
    if (filterStaff) {
      if (!bridge.processes.some((p) => p.staff?.name === filterStaff)) return false;
    }
    if (filterStatus) {
      if (calcOverallStatus(bridge.processes) !== filterStatus) return false;
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
    <div className="d3-body">
      {/* ヘッダー行 */}
      <div className="d3-headrow">
        <div>
          <h1 className="d3-h1">工程<span className="em">予定表</span></h1>
          <div className="d3-hsub">橋梁ごとの工程スケジュールと進捗を管理します</div>
        </div>
        <div className="d3-toolbar">
          {/* ガント / リスト 切り替え */}
          <div className="d3-segwrap">
            <span className={`d3-seg${view === "gantt" ? " on" : ""}`} onClick={() => setView("gantt")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h9M4 12h14M4 18h7"/></svg>
              ガント
            </span>
            <span className={`d3-seg${view === "list" ? " on" : ""}`} onClick={() => setView("list")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>
              リスト
            </span>
          </div>
          <Link href="/settings" className="d3-primary">
            <span style={{ fontSize: 15 }}>＋</span>業務を追加
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="d3-placeholder"><div className="pi"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 16c4 0 4-6 10-6s6 6 10 6"/><path d="M2 16v3M22 16v3M8 13v6M16 13v6M12 11v8"/></svg></div><b>読み込み中...</b></div>
      ) : projects.length === 0 ? (
        <div className="d3-placeholder">
          <div className="pi"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 16c4 0 4-6 10-6s6 6 10 6"/><path d="M2 16v3M22 16v3M8 13v6M16 13v6M12 11v8"/></svg></div>
          <b>業務がまだ登録されていません</b>
          <Link href="/settings" className="d3-primary">マスタ管理へ →</Link>
        </div>
      ) : view === "gantt" ? (
        /* ═══════════════ ガントチャートビュー ═══════════════ */
        <div>
          {/* 月ナビ + 工程フィルター */}
          <div className="d3-subrow">
            <div className="d3-month">
              <button className="d3-mbtn" onClick={() => setMonth(prevMonth(month))}>← 前月</button>
              <button className="d3-mbtn" onClick={() => setMonth(currentMonth())}>今月</button>
              <span className="d3-mtitle"><span className="curr">{year}年{monthNum}月</span></span>
              <button className="d3-mbtn" onClick={() => setMonth(nextMonth(month))}>翌月 →</button>
              {saving && <span className="d3-saving">保存中...</span>}
            </div>
            <div className="d3-legend">
              <button
                className={`d3-lg${filterTypeId === null ? " all" : ""}`}
                onClick={() => setFilterTypeId(null)}
              >
                全工程
              </button>
              {processTypes.map((pt) => (
                <button
                  key={pt.id}
                  className={`d3-lg${filterTypeId === pt.id ? " on" : ""}`}
                  onClick={() => setFilterTypeId(filterTypeId === pt.id ? null : pt.id)}
                  style={filterTypeId === pt.id ? { borderColor: pt.color, color: pt.color } : {}}
                >
                  <span className="sw" style={{ backgroundColor: pt.color }} />
                  {pt.name}
                </button>
              ))}
            </div>
          </div>

          {/* アコーディオン */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {projects.map((project) => {
              const isExpanded = expandedProjectIds.has(project.id);
              return (
                <div key={project.id}>
                  {/* アコーディオンヘッダー */}
                  <div className="d3-sec" onClick={() => toggleProject(project.id)}>
                    <span className="tri">{isExpanded ? "▼" : "▶"}</span>
                    <span className="sec-name">{project.name}</span>
                    {project.client && <span className="sec-client">{project.client}</span>}
                    <span className="sec-cnt">{project.bridges.length}橋</span>
                    {project.deadline && (
                      <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>期限：{formatDate(project.deadline)}</span>
                    )}
                    <button
                      className="sec-add"
                      onClick={(e) => { e.stopPropagation(); setAddBridgeProjectId(project.id); }}
                    >
                      ＋ 橋梁を追加
                    </button>
                  </div>

                  {/* 展開コンテンツ */}
                  {isExpanded && (
                    <div className="d3-card" style={{ marginLeft: 16 }}>
                      {/* 業務全体行（業務に直接登録） */}
                      <div className="flex items-stretch border-b border-gray-100 group bg-gray-50">
                        <div className="flex items-center px-4 py-1.5 flex-shrink-0" style={{ width: 220 }}>
                          <span className="text-xs text-gray-400 italic">業務全体</span>
                        </div>
                        <div className="flex-1 border-l border-gray-100 min-w-0">
                          <GanttGrid year={year} month={monthNum}>
                            <div
                              className="relative cursor-cell"
                              style={{ height: 32 }}
                              onClick={(e) => handleGridClick(e, { projectId: project.id, projectName: project.name })}
                            >
                              {project.processes
                                .filter((proc) => filterTypeId === null || proc.processType.id === filterTypeId)
                                .map((proc) => (
                                  <GanttBar
                                    key={proc.id}
                                    id={proc.id}
                                    startDate={proc.startDate}
                                    endDate={proc.endDate}
                                    completedDate={proc.completedDate}
                                    color={proc.processType.color}
                                    staffName={proc.staffMembers && proc.staffMembers.length > 0 ? proc.staffMembers.map((sm) => sm.staff.name).join("・") : (proc.staff?.name ?? null)}
                                    processName={proc.processType.name}
                                    year={year}
                                    month={monthNum}
                                    onDragEnd={handleDragEnd}
                                    onClick={(rid) => handleBarClick(rid, project.processes, project.name, "業務全体")}
                                  />
                                ))}
                            </div>
                          </GanttGrid>
                        </div>
                      </div>

                      {/* 橋梁がない場合 */}
                      {project.bridges.length === 0 && (
                        <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
                          橋梁が未登録です。上の「＋橋梁を追加」から追加できます。
                        </div>
                      )}

                      {/* 橋梁行 */}
                      {project.bridges.map((bridge) => (
                        <div key={bridge.id} className="d3-row group" style={{ minHeight: 44 }}>
                          <div className="d3-rl" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <button
                              onClick={() => router.push(`/bridges/${bridge.id}`)}
                              style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 0 }}
                            >
                              <div className="nm" style={{ truncate: true }}>{bridge.name}</div>
                              {bridge.serialNo && <div className="no">{bridge.serialNo}</div>}
                            </button>
                            <button
                              onClick={() => handleBridgeDelete(bridge.id, bridge.name)}
                              className="opacity-0 group-hover:opacity-100 transition-all"
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "0 4px", flexShrink: 0 }}
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
                                onClick={(e) => handleGridClick(e, { projectId: project.id, projectName: project.name, bridgeId: bridge.id, bridgeName: bridge.name })}
                              >
                                {/* 自動割り振りバー：全工程 or 調書作成フィルター時のみ表示 */}
                                {(() => {
                                  const choshoType = processTypes.find((pt) => pt.name === "調書作成");
                                  const show = filterTypeId === null || (choshoType && filterTypeId === choshoType.id);
                                  if (!show) return null;
                                  return bridge.assignments?.map((a) => (
                                    <GanttBar
                                      key={`assign-${a.id}`}
                                      id={a.id}
                                      startDate={a.startDate}
                                      endDate={a.endDate}
                                      color={choshoType?.color ?? "#EF4444"}
                                      staffName={a.staff.name}
                                      processName="調書作成"
                                      customLabel={a.isManual ? `${a.staff.name} ✏` : `${a.staff.name} 📋`}
                                      year={year}
                                      month={monthNum}
                                      onDragEnd={(aid, ns, ne) => handleAssignmentDragEnd(aid, ns, ne)}
                                      onClick={(aid) => handleAssignmentBarClick(aid, bridge, project.name)}
                                    />
                                  ));
                                })()}
                                {/* 工程バー：割り振りバーがある橋梁の調書作成は非表示（割り振りバーが代替） */}
                                {bridge.processes
                                  .filter((proc) => filterTypeId === null || proc.processType.id === filterTypeId)
                                  .filter((proc) => {
                                    const hasAssignments = (bridge.assignments?.length ?? 0) > 0;
                                    if (hasAssignments && proc.processType.name === "調書作成") return false;
                                    return true;
                                  })
                                  .map((proc) => (
                                    <GanttBar
                                      key={proc.id}
                                      id={proc.id}
                                      startDate={proc.startDate}
                                      endDate={proc.endDate}
                                      completedDate={proc.completedDate}
                                      color={proc.processType.color}
                                      staffName={proc.staffMembers && proc.staffMembers.length > 0 ? proc.staffMembers.map((sm) => sm.staff.name).join("・") : (proc.staff?.name ?? null)}
                                      processName={proc.processType.name}
                                      year={year}
                                      month={monthNum}
                                      onDragEnd={handleDragEnd}
                                      onClick={(rid) => handleBarClick(rid, bridge.processes, project.name, bridge.name)}
                                    />
                                  ))}
                              </div>
                            </GanttGrid>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ═══════════════ リストビュー ═══════════════ */
        <div>
          {/* フィルターバー */}
          <div className="d3-panel" style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>橋梁名検索</label>
              <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="橋梁名・業務名..." className="d3-input" style={{ width: 160 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>担当者</label>
              <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="d3-input" style={{ width: "auto" }}>
                <option value="">すべて</option>
                {staffNames.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>現在工程</label>
              <select value={filterProcess} onChange={(e) => setFilterProcess(e.target.value)} className="d3-input" style={{ width: "auto" }}>
                <option value="">すべて</option>
                {processNames.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>ステータス</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="d3-input" style={{ width: "auto" }}>
                <option value="">すべて</option>
                <option value="NOT_STARTED">未着手</option>
                <option value="IN_PROGRESS">作業中</option>
                <option value="COMPLETED">完了</option>
                <option value="DELAYED">遅延</option>
              </select>
            </div>
            {(filterStaff || filterStatus || filterProcess || searchText) && (
              <button className="d3-ghost" onClick={() => { setFilterStaff(""); setFilterStatus(""); setFilterProcess(""); setSearchText(""); }}>クリア</button>
            )}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{sortedBridges.length}件</span>
              {selectedBridgeIds.size > 0 && (
                <button onClick={handleBridgeBulkDelete} style={{ background: "#EF4444", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  🗑 選択削除（{selectedBridgeIds.size}件）
                </button>
              )}
            </div>
          </div>

          {/* テーブル */}
          <div className="d3-card">
            <table className="d3-table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={sortedBridges.length > 0 && sortedBridges.every((b) => selectedBridgeIds.has(b.id))}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedBridgeIds.size > 0 && !sortedBridges.every((b) => selectedBridgeIds.has(b.id));
                      }}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBridgeIds(new Set(sortedBridges.map((b) => b.id)));
                        else setSelectedBridgeIds(new Set());
                      }}
                    />
                  </th>
                  <th>業務名</th>
                  <th>整理番号</th>
                  <th>橋梁名</th>
                  <th>径間数</th>
                  <th>現在工程</th>
                  <th>担当者</th>
                  <th>完了予定日</th>
                  <th style={{ cursor: "pointer" }} onClick={() => setSortKey(nextSortKey("inspectionDate"))}>
                    点検完了日{sortIcon("inspectionDate")}
                  </th>
                  <th>ステータス</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedBridges.length === 0 ? (
                  <tr><td colSpan={11} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>該当する橋梁がありません</td></tr>
                ) : sortedBridges.map((bridge) => {
                  const currentProcessName = getCurrentProcess(bridge.processes);
                  const currentRecord = bridge.processes.find((p) => p.processType.name === currentProcessName && !p.completedDate);
                  const overallStatus = calcOverallStatus(bridge.processes);
                  const isChecked = selectedBridgeIds.has(bridge.id);
                  return (
                    <tr
                      key={bridge.id}
                      className="group"
                      style={isChecked ? { background: "#F0EFFE" } : {}}
                      onClick={() => router.push(`/bridges/${bridge.id}`)}
                    >
                      <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = new Set(selectedBridgeIds);
                            e.target.checked ? next.add(bridge.id) : next.delete(bridge.id);
                            setSelectedBridgeIds(next);
                          }}
                        />
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{bridge.projectName}</td>
                      <td style={{ color: "var(--muted)" }}>{bridge.serialNo ?? "-"}</td>
                      <td style={{ fontWeight: 700 }}>{bridge.name}</td>
                      <td style={{ textAlign: "center" }}>{bridge.spans ?? "-"}</td>
                      <td>{currentProcessName}</td>
                      <td>
                        {currentRecord
                          ? (currentRecord.staffMembers && currentRecord.staffMembers.length > 0
                              ? currentRecord.staffMembers.map((sm) => sm.staff.name).join("・")
                              : currentRecord.staff?.name ?? "-")
                          : "-"}
                      </td>
                      <td>{currentRecord?.endDate ? formatDate(currentRecord.endDate) : "-"}</td>
                      <td>{bridge.inspectionDate ? formatDate(bridge.inspectionDate) : "-"}</td>
                      <td><StatusBadge status={overallStatus} /></td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBridgeDelete(bridge.id, bridge.name); }}
                          className="opacity-0 group-hover:opacity-100 transition-all"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 14, padding: "0 4px" }}
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

      {/* 工程編集モーダル */}
      {editTarget && (
        <ProcessEditModal
          record={editTarget.record}
          staff={staff}
          bridgeName={editTarget.bridgeName}
          projectName={editTarget.projectName}
          onSave={handleModalSave}
          onDelete={handleProcessDelete}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* 割り振り編集モーダル */}
      {assignmentEditTarget && (
        <AssignmentEditModal
          assignment={assignmentEditTarget.assignment}
          bridgeName={assignmentEditTarget.bridgeName}
          projectName={assignmentEditTarget.projectName}
          staff={staff}
          onSave={handleAssignmentSave}
          onDelete={handleAssignmentDelete}
          onClose={() => setAssignmentEditTarget(null)}
        />
      )}

      {/* 橋梁追加モーダル */}
      {addBridgeProjectId !== null && (
        <BridgeFormModal
          projectName={projects.find((p) => p.id === addBridgeProjectId)?.name ?? ""}
          onSave={handleBridgeAdd}
          onClose={() => setAddBridgeProjectId(null)}
        />
      )}

      {/* 新規工程登録モーダル */}
      {createTarget && (
        <ProcessCreateModal
          projectId={createTarget.projectId}
          projectName={createTarget.projectName}
          bridgeId={createTarget.bridgeId}
          bridgeName={createTarget.bridgeName}
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
