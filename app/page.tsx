"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  getMonthSequence, calcMultiMonthBar, isWeekend,
} from "@/lib/utils";

interface Staff { id: number; name: string; }

interface ProcessRecord {
  id: number;
  processTypeId: number;
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
  processTypeId: number | null;
  processType: { id: number; name: string; color: string } | null;
  startDate: string | null;
  endDate: string | null;
  isManual: boolean;
  staff: { id: number; name: string; color: string };
}

interface BridgeProcessConfig {
  processTypeId: number;
  requiredHours: number | null;
}

interface Bridge {
  id: number;
  name: string;
  serialNo: string | null;
  spans: number | null;
  inspectionDate: string | null;
  processes: ProcessRecord[];
  assignments: BridgeAssignment[];
  processConfigs: BridgeProcessConfig[];
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
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [view, setView] = useState<"gantt" | "list">("gantt");
  // ヘッダー・コンテンツ・下部スクロールバーの3方向同期用
  const ganttHeaderRef = useRef<HTMLDivElement>(null);
  const ganttContentRef = useRef<HTMLDivElement>(null);
  const ganttScrollbarRef = useRef<HTMLDivElement>(null);
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
  const [holidays, setHolidays] = useState<string[]>([]);

  const { year, month: monthNum } = parseYearMonth(month);
  const daysInMonth = getDaysInMonth(year, monthNum);

  // 6ヶ月タイムライン設定
  const DAY_WIDTH = 26; // px/day
  const MONTH_COUNT = 6;
  const months = useMemo(() => getMonthSequence(month, MONTH_COUNT), [month]);
  const totalDays = useMemo(
    () => months.reduce((s, m) => s + getDaysInMonth(m.year, m.month), 0),
    [months]
  );
  const LABEL_WIDTH = 220;
  const timelineWidth = totalDays * DAY_WIDTH;

  // タイムライン上のバー位置計算ヘルパー
  const barPx = useCallback(
    (start: string | null | undefined, end: string | null | undefined) =>
      calcMultiMonthBar(start, end, month, totalDays, DAY_WIDTH),
    [month, totalDays]
  );

  // 土日・公休日の背景セル情報（月ごとにキャッシュ）
  const bgCells = useMemo(() => {
    const cells: Array<{ off: boolean; holiday: boolean; isToday: boolean }> = [];
    const today = new Date();
    for (const m of months) {
      const days = getDaysInMonth(m.year, m.month);
      const holidayDays = new Set(
        holidays
          .filter((h) => {
            const [hy, hm] = h.split("-").map(Number);
            return hy === m.year && hm === m.month;
          })
          .map((h) => parseInt(h.split("-")[2]))
      );
      for (let d = 1; d <= days; d++) {
        const isHol = holidayDays.has(d);
        const isWe = isWeekend(m.year, m.month, d);
        const isTod =
          today.getFullYear() === m.year &&
          today.getMonth() + 1 === m.month &&
          today.getDate() === d;
        cells.push({ off: isWe || isHol, holiday: isHol, isToday: isTod });
      }
    }
    return cells;
  }, [months, holidays]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/gantt/dashboard?month=${month}`).then((r) => r.json()),
      fetch("/api/staff").then((r) => r.json()),
      fetch("/api/process-types").then((r) => r.json()),
      fetch("/api/holidays").then((r) => r.json()),
    ]).then(([projectsData, staffData, typesData, holidaysData]) => {
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setStaff(Array.isArray(staffData) ? staffData : []);
      setProcessTypes(Array.isArray(typesData) ? [...typesData].sort((a: ProcessType, b: ProcessType) => a.order - b.order) : []);
      setHolidays(Array.isArray(holidaysData) ? holidaysData.map((h: any) => h.date) : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [month]);

  useEffect(() => { loadData(); }, [loadData]);

  // プロジェクトロード後、最初のプロジェクトを選択
  useEffect(() => {
    if (projects.length > 0) {
      setSelectedProjectId((prev) => prev ?? projects[0].id);
      setExpandedProjectIds((prev) => {
        const next = new Set(prev);
        projects.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }, [projects]);

  // コンテンツスクロール → 下部スクロールバー同期
  const handleGanttScroll = useCallback(() => {
    if (ganttScrollbarRef.current && ganttContentRef.current) {
      ganttScrollbarRef.current.scrollLeft = ganttContentRef.current.scrollLeft;
    }
  }, []);
  // 下部スクロールバー → コンテンツ同期
  const handleScrollbarScroll = useCallback(() => {
    if (ganttContentRef.current && ganttScrollbarRef.current) {
      ganttContentRef.current.scrollLeft = ganttScrollbarRef.current.scrollLeft;
    }
  }, []);

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
      processTypeId: data.processTypeId,
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
          {/* 業務プルダウン・橋梁追加（ガント時のみ） */}
          {view === "gantt" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>業務：</span>
                <select
                  value={selectedProjectId ?? ""}
                  onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                  className="d3-input"
                  style={{ minWidth: 160, maxWidth: 260 }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <button
                className="d3-primary"
                onClick={() => selectedProjectId && setAddBridgeProjectId(selectedProjectId)}
                disabled={!selectedProjectId}
              >
                <span style={{ fontSize: 15 }}>＋</span>橋梁を追加
              </button>
            </>
          )}
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
          {/* 月ナビ */}
          <div className="d3-subrow">
            <div className="d3-month">
              <button className="d3-mbtn" onClick={() => setMonth(prevMonth(month))}>← 前月</button>
              <button className="d3-mbtn" onClick={() => setMonth(currentMonth())}>今月</button>
              <span className="d3-mtitle">
                <span className="curr">{year}年{monthNum}月</span>
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, marginLeft: 6 }}>
                  〜 {months[months.length - 1].year}年{months[months.length - 1].month}月
                </span>
              </span>
              <button className="d3-mbtn" onClick={() => setMonth(nextMonth(month))}>翌月 →</button>
              {saving && <span className="d3-saving">保存中...</span>}
            </div>
          </div>

          {/* ─── 6ヶ月 横スクロール ガント ─── */}
          {(() => {
            const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null;
            return (
              /*
               * 1つのスクロールコンテナで縦横両方を管理。
               * position:sticky は同一スクロールコンテナ内でのみ正しく動作する。
               * ヘッダー行は top:0/top:28 でスティッキー、橋梁ラベルは left:0 でスティッキー。
               */
              <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", borderRadius: 8, border: "1px solid #E2E4EE", overflow: "hidden" }}>
                {/* メインスクロールコンテナ（縦横両方） */}
                <div
                  ref={ganttContentRef}
                  onScroll={handleGanttScroll}
                  className="no-scrollbar"
                  style={{ flex: 1, overflow: "auto" }}
                >
                  <div style={{ minWidth: LABEL_WIDTH + timelineWidth }}>

                    {/* 月ヘッダー行（sticky top:0） */}
                    <div style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", background: "var(--surface, #F7F8FC)", borderBottom: "2px solid #E2E4EE" }}>
                      {/* 左上コーナー */}
                      <div style={{ width: LABEL_WIDTH, flexShrink: 0, position: "sticky", left: 0, zIndex: 31, background: "var(--surface, #F7F8FC)", borderRight: "1px solid #E2E4EE" }} />
                      {months.map((m) => (
                        <div key={m.ym} style={{ width: getDaysInMonth(m.year, m.month) * DAY_WIDTH, flexShrink: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--ink)", padding: "5px 0", borderRight: "1px solid #E2E4EE", borderLeft: "1px solid #C5C8D8" }}>
                          {m.year}年{m.month}月
                        </div>
                      ))}
                    </div>

                    {/* 日ヘッダー行（sticky top:28） */}
                    <div style={{ position: "sticky", top: 28, zIndex: 30, display: "flex", background: "var(--surface, #F7F8FC)", borderBottom: "1px solid #E2E4EE" }}>
                      {/* 左上コーナー */}
                      <div style={{ width: LABEL_WIDTH, flexShrink: 0, position: "sticky", left: 0, zIndex: 31, background: "var(--surface, #F7F8FC)", borderRight: "1px solid #E2E4EE" }} />
                      {bgCells.map((cell, i) => {
                        let offset = i, dayNum = 0;
                        for (const m of months) {
                          const days = getDaysInMonth(m.year, m.month);
                          if (offset < days) { dayNum = offset + 1; break; }
                          offset -= days;
                        }
                        return (
                          <div key={i} style={{ width: DAY_WIDTH, flexShrink: 0, textAlign: "center", fontSize: 9, padding: "2px 0", color: cell.holiday ? "#F87171" : cell.off ? "#9CA3AF" : "#6B7280", background: cell.holiday ? "#FEF2F2" : cell.off ? "#F3F4F6" : undefined, borderRight: "1px solid #EEF0F6" }}>
                            {dayNum}
                          </div>
                        );
                      })}
                    </div>

                    {/* コンテンツ行 */}
                    {!selectedProject ? (
                      <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>業務を選択してください</div>
                    ) : (
                      <div style={{ borderRadius: "0 0 8px 8px", overflow: "visible" }}>
                        {/* 業務全体行 */}
                        <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #F1F3F9", background: "#FAFBFC" }}>
                          <div style={{ width: LABEL_WIDTH, flexShrink: 0, position: "sticky", left: 0, zIndex: 15, background: "#FAFBFC", borderRight: "1px solid #E2E4EE", display: "flex", alignItems: "center", padding: "0 12px" }}>
                            <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>業務全体</span>
                          </div>
                          <div style={{ position: "relative", width: timelineWidth, height: 32, flexShrink: 0, cursor: "cell" }} onClick={(e) => handleGridClick(e, { projectId: selectedProject.id, projectName: selectedProject.name })}>
                            <div className="absolute inset-0 flex pointer-events-none">
                              {bgCells.map((cell, i) => <div key={i} style={{ width: DAY_WIDTH, flexShrink: 0, height: "100%", background: cell.holiday ? "rgba(254,226,226,0.5)" : cell.off ? "rgba(0,0,0,0.025)" : undefined }} />)}
                            </div>
                            {bgCells.map((cell, i) => cell.isToday ? <div key="today" className="absolute top-0 bottom-0 pointer-events-none z-10" style={{ left: (i + 0.5) * DAY_WIDTH, width: 1, background: "#F87171" }} /> : null)}
                            {selectedProject.processes.filter((proc) => filterTypeId === null || proc.processType.id === filterTypeId).map((proc) => {
                              const px = barPx(proc.startDate, proc.endDate);
                              if (!px) return null;
                              return <GanttBar key={proc.id} id={proc.id} startDate={proc.startDate} endDate={proc.endDate} completedDate={proc.completedDate} color={proc.processType.color} staffName={proc.staffMembers && proc.staffMembers.length > 0 ? proc.staffMembers.map((sm) => sm.staff.name).join("・") : (proc.staff?.name ?? null)} processName={proc.processType.name} year={year} month={monthNum} pixelLeft={px.left} pixelWidth={px.width} dayWidth={DAY_WIDTH} onDragEnd={handleDragEnd} onClick={(rid) => handleBarClick(rid, selectedProject.processes, selectedProject.name, "業務全体")} />;
                            })}
                          </div>
                        </div>

                        {selectedProject.bridges.length === 0 && (
                          <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
                            橋梁が未登録です。上の「＋橋梁を追加」から追加できます。
                          </div>
                        )}

                        {/* 橋梁行 */}
                        {selectedProject.bridges.map((bridge) => (
                          <div key={bridge.id} className="group" style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #F1F3F9", minHeight: 44 }}>
                            {/* 橋梁名ラベル（left:0 でスティッキー） */}
                            <div style={{ width: LABEL_WIDTH, flexShrink: 0, position: "sticky", left: 0, zIndex: 15, background: "white", borderRight: "1px solid #E2E4EE", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 0 12px" }}>
                              <button onClick={() => router.push(`/bridges/${bridge.id}`)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 0 }}>
                                <div className="nm" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bridge.name}</div>
                                {bridge.serialNo && <div className="no" style={{ fontSize: 11, color: "var(--muted)" }}>{bridge.serialNo}</div>}
                              </button>
                              <button onClick={() => handleBridgeDelete(bridge.id, bridge.name)} className="opacity-0 group-hover:opacity-100 transition-all" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "0 4px", flexShrink: 0 }} title="この橋梁を削除">🗑</button>
                            </div>

                            {/* ガントエリア */}
                            <div style={{ position: "relative", width: timelineWidth, height: 44, flexShrink: 0, cursor: "cell" }} onClick={(e) => handleGridClick(e, { projectId: selectedProject.id, projectName: selectedProject.name, bridgeId: bridge.id, bridgeName: bridge.name })}>
                              <div className="absolute inset-0 flex pointer-events-none">
                                {bgCells.map((cell, i) => <div key={i} style={{ width: DAY_WIDTH, flexShrink: 0, height: "100%", background: cell.holiday ? "rgba(254,226,226,0.5)" : cell.off ? "rgba(0,0,0,0.025)" : undefined }} />)}
                              </div>
                              {bgCells.map((cell, i) => cell.isToday ? <div key="today" className="absolute top-0 bottom-0 pointer-events-none z-10" style={{ left: (i + 0.5) * DAY_WIDTH, width: 1, background: "#F87171" }} /> : null)}
                              {(() => { let offset = 0; return months.slice(0, -1).map((m) => { offset += getDaysInMonth(m.year, m.month) * DAY_WIDTH; return <div key={m.ym} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: offset, width: 1, background: "#C5C8D8" }} />; }); })()}

                              {bridge.assignments?.filter((a) => { if (filterTypeId === null) return true; if (a.processTypeId != null) return a.processTypeId === filterTypeId; return processTypes.find((pt) => pt.name === "調書作成")?.id === filterTypeId; }).map((a) => {
                                const px = barPx(a.startDate, a.endDate);
                                if (!px) return null;
                                const ptColor = a.processType?.color ?? processTypes.find((pt) => pt.name === "調書作成")?.color ?? "#EF4444";
                                const cfg = a.processTypeId != null ? bridge.processConfigs?.find((c) => c.processTypeId === a.processTypeId) : bridge.processConfigs?.find((c) => c.processTypeId === processTypes.find((pt) => pt.name === "調書作成")?.id);
                                return <GanttBar key={`assign-${a.id}`} id={a.id} startDate={a.startDate} endDate={a.endDate} color={ptColor} staffName={a.staff.name} processName={a.processType?.name ?? "調書作成"} customLabel={a.isManual ? `${a.staff.name} ✏` : `${a.staff.name} 📋`} requiredHours={cfg?.requiredHours ?? null} year={year} month={monthNum} pixelLeft={px.left} pixelWidth={px.width} dayWidth={DAY_WIDTH} onDragEnd={(aid, ns, ne) => handleAssignmentDragEnd(aid, ns, ne)} onClick={(aid) => handleAssignmentBarClick(aid, bridge, selectedProject.name)} />;
                              })}

                              {bridge.processes.filter((proc) => filterTypeId === null || proc.processType.id === filterTypeId).filter((proc) => !bridge.assignments?.some((a) => (a.processTypeId === proc.processType.id) || (a.processTypeId == null && proc.processType.name === "調書作成"))).map((proc) => {
                                const px = barPx(proc.startDate, proc.endDate);
                                if (!px) return null;
                                const procCfg = bridge.processConfigs?.find((c) => c.processTypeId === proc.processType.id);
                                return <GanttBar key={proc.id} id={proc.id} startDate={proc.startDate} endDate={proc.endDate} completedDate={proc.completedDate} color={proc.processType.color} staffName={proc.staffMembers && proc.staffMembers.length > 0 ? proc.staffMembers.map((sm) => sm.staff.name).join("・") : (proc.staff?.name ?? null)} processName={proc.processType.name} requiredHours={procCfg?.requiredHours ?? null} year={year} month={monthNum} pixelLeft={px.left} pixelWidth={px.width} dayWidth={DAY_WIDTH} onDragEnd={handleDragEnd} onClick={(rid) => handleBarClick(rid, bridge.processes, selectedProject.name, bridge.name)} />;
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 常時表示の横スクロールバー（下部固定） */}
                <div ref={ganttScrollbarRef} onScroll={handleScrollbarScroll} style={{ overflowX: "auto", overflowY: "hidden", flexShrink: 0, borderTop: "1px solid #E2E4EE" }}>
                  <div style={{ width: LABEL_WIDTH + timelineWidth, height: 1 }} />
                </div>
              </div>
            );
          })()}
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
