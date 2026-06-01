"use client";
import { useEffect, useState, useCallback, useRef } from "react";

// ─── 型定義 ─────────────────────────────────────────────
interface Staff { id: number; name: string; color: string; type: string; }
interface Bridge {
  id: number;
  name: string;
  serialNo: string | null;
  spans: number | null;
  spanCount: number;
  spanCoefficient: number;
  inspectionDate: string | null;
  projectId: number;
  project: { name: string };
}
interface Project { id: number; name: string; bridges: Bridge[]; }
interface Assignment {
  id: number;
  bridgeId: number;
  staffId: number;
  fiscalYear: number;
  startDate: string | null;
  endDate: string | null;
  inspectionDoneDate: string | null;
  isManual: boolean;
  bridge: Bridge & { project: { name: string } };
  staff: Staff;
}

// ─── ユーティリティ ──────────────────────────────────────
function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
// タイムゾーンズレなしで "YYYY-MM-DD" に変換（APIから返ってくるUTC日時用）
function toLocalDateStr(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function getDaysInMonth(y: number, m: number): number { return new Date(y, m, 0).getDate(); }
function formatYMD(s: string | null): string {
  if (!s) return "-";
  return s.slice(0, 10).replace(/-/g, "/");
}
function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = getDaysInMonth(year, month);
  for (let i = 1; i <= d; i++) days.push(new Date(year, month - 1, i));
  return days;
}

// ─── ガントバー ──────────────────────────────────────────
interface GanttBarProps {
  assignment: Assignment;
  year: number;
  month: number;
  staffColor: string;
  onDragEnd: (id: number, newStart: string, newEnd: string) => void;
  onClick: (a: Assignment) => void;
}

function AssignmentBar({ assignment, year, month, staffColor, onDragEnd, onClick }: GanttBarProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const barRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; origStart: Date; origEnd: Date } | null>(null);

  if (!assignment.startDate || !assignment.endDate) return null;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const barStart = new Date(assignment.startDate);
  const barEnd = new Date(assignment.endDate);

  if (barEnd < monthStart || barStart > monthEnd) return null;

  const clampedStart = barStart < monthStart ? monthStart : barStart;
  const clampedEnd = barEnd > monthEnd ? monthEnd : barEnd;
  const leftPct = ((clampedStart.getDate() - 1) / daysInMonth) * 100;
  const widthPct = ((clampedEnd.getDate() - clampedStart.getDate() + 1) / daysInMonth) * 100;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!barRef.current) return;
    dragState.current = {
      startX: e.clientX,
      origStart: new Date(assignment.startDate!),
      origEnd: new Date(assignment.endDate!),
    };
    const containerWidth = barRef.current.parentElement!.offsetWidth;
    const dayWidth = containerWidth / daysInMonth;

    const handleMouseMove = (me: MouseEvent) => {
      if (!dragState.current || !barRef.current) return;
      const dx = me.clientX - dragState.current.startX;
      const daysDelta = Math.round(dx / dayWidth);
      const newStart = addDays(dragState.current.origStart, daysDelta);
      const ns = Math.max(0, ((newStart.getTime() - monthStart.getTime()) / 86400000) / daysInMonth) * 100;
      barRef.current.style.left = `${Math.max(0, Math.min(100 - widthPct, ns))}%`;
    };

    const handleMouseUp = (me: MouseEvent) => {
      if (!dragState.current) return;
      const dx = me.clientX - dragState.current.startX;
      const daysDelta = Math.round(dx / dayWidth);
      if (daysDelta !== 0) {
        const newStart = addDays(dragState.current.origStart, daysDelta);
        const newEnd = addDays(dragState.current.origEnd, daysDelta);
        onDragEnd(assignment.id, toDateStr(newStart), toDateStr(newEnd));
      }
      dragState.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={barRef}
      className="absolute top-1 bottom-1 rounded flex items-center px-2 cursor-grab select-none overflow-hidden"
      style={{
        left: `${leftPct}%`,
        width: `${Math.max(widthPct, 0.5)}%`,
        backgroundColor: staffColor,
        opacity: 0.85,
        zIndex: 10,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); onClick(assignment); }}
      title={`${assignment.staff.name} / ${assignment.bridge.name}\n${formatYMD(assignment.startDate)} 〜 ${formatYMD(assignment.endDate)}${assignment.isManual ? " (手動)" : ""}`}
    >
      <span className="text-white text-xs truncate font-medium pointer-events-none">
        {assignment.staff.name}{assignment.isManual && " ✏️"}
      </span>
    </div>
  );
}

// 旗マーク（点検完了日）
function InspectionFlag({ date, year, month }: { date: string; year: number; month: number }) {
  const d = new Date(date);
  if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return null;
  const daysInMonth = getDaysInMonth(year, month);
  const leftPct = ((d.getDate() - 1) / daysInMonth) * 100;
  return (
    <div
      className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
      style={{ left: `${leftPct}%`, zIndex: 5 }}
      title={`点検完了日：${formatYMD(date)}`}
    >
      <div className="w-px h-full bg-orange-400 opacity-60" />
      <span className="absolute top-0 text-orange-500 text-xs">🚩</span>
    </div>
  );
}

// ─── メインページ ────────────────────────────────────────
export default function AutoAssignPage() {
  const now = new Date();
  const currentFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const [fiscalYear, setFiscalYear] = useState(currentFY);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // 選択中の業務
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // 業務ごとの担当者選択（業務ID → staffId[]）
  const [projectStaffMap, setProjectStaffMap] = useState<Record<number, number[]>>({});
  const [savingStaff, setSavingStaff] = useState(false);

  // 点検完了日
  const [inspectionDates, setInspectionDates] = useState<Record<number, string>>({});

  // 点検完了日から何日後に作業開始するか
  const [daysAfterInspection, setDaysAfterInspection] = useState(8);

  // 実行
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [unassignedBridges, setUnassignedBridges] = useState<{ id: number; name: string; reason: string }[]>([]);

  // ガント表示
  const [ganttYear, setGanttYear] = useState(currentFY);
  const [ganttMonth, setGanttMonth] = useState(4);
  const [filterStaffId, setFilterStaffId] = useState<number | null>(null);

  // 連動移動ダイアログ
  const [shiftDialog, setShiftDialog] = useState<{ staffId: number; staffName: string } | null>(null);
  const [shiftDays, setShiftDays] = useState("0");

  // バー編集ダイアログ
  const [editTarget, setEditTarget] = useState<Assignment | null>(null);
  const [editForm, setEditForm] = useState({ startDate: "", endDate: "" });

  // ─── データ読み込み ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const [projectsRes, staffRes, assignRes] = await Promise.all([
      fetch(`/api/gantt/dashboard?month=${fiscalYear}-04`).then((r) => r.json()),
      fetch("/api/staff").then((r) => r.json()),
      fetch(`/api/assignments?year=${fiscalYear}`).then((r) => r.json()),
    ]);

    const pList: Project[] = Array.isArray(projectsRes)
      ? projectsRes.map((p: any) => ({
          id: p.id,
          name: p.name,
          bridges: (p.bridges ?? []).map((b: any) => ({
            id: b.id,
            name: b.name,
            serialNo: b.serialNo,
            spans: b.spans ?? null,
            spanCount: b.spanCount ?? 1,
            spanCoefficient: b.spanCoefficient ?? 0.5,
            inspectionDate: b.inspectionDate ? toLocalDateStr(b.inspectionDate) : null,
            projectId: p.id,
            project: { name: p.name },
          })),
        }))
      : [];

    const sList: Staff[] = Array.isArray(staffRes) ? staffRes : [];
    const aList: Assignment[] = Array.isArray(assignRes) ? assignRes : [];

    setProjects(pList);
    setAllStaff(sList);
    setAssignments(aList);

    // 点検完了日：まず橋梁マスタのinspectionDateを初期値に設定
    const dMap: Record<number, string> = {};
    for (const p of pList) {
      for (const b of p.bridges) {
        if (b.inspectionDate) dMap[b.id] = b.inspectionDate;
      }
    }
    // 割り振り済みデータのinspectionDoneDateで上書き（こちらを優先）
    for (const a of aList) {
      if (a.inspectionDoneDate) dMap[a.bridgeId] = toLocalDateStr(a.inspectionDoneDate);
    }
    setInspectionDates(dMap);

    // 各業務の担当者を読み込む
    const psMap: Record<number, number[]> = {};
    for (const p of pList) {
      try {
        const r = await fetch(`/api/projects/${p.id}/staff`);
        const data = await r.json();
        psMap[p.id] = Array.isArray(data) ? data.map((d: any) => d.staffId) : [];
      } catch {
        psMap[p.id] = [];
      }
    }
    setProjectStaffMap(psMap);

    // 選択業務の初期化
    if (pList.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(pList[0].id);
    }

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalYear]);

  useEffect(() => { loadData(); }, [loadData]);

  // 選択中の業務データ
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const selectedBridges = selectedProject?.bridges ?? [];
  const selectedStaffIds = selectedProjectId ? (projectStaffMap[selectedProjectId] ?? []) : [];

  // ─── 担当者トグル ───────────────────────────────────────
  const handleToggleStaff = (staffId: number) => {
    if (!selectedProjectId) return;
    const current = projectStaffMap[selectedProjectId] ?? [];
    const next = current.includes(staffId)
      ? current.filter((id) => id !== staffId)
      : [...current, staffId];
    setProjectStaffMap((prev) => ({ ...prev, [selectedProjectId]: next }));
  };

  const handleSaveStaff = async () => {
    if (!selectedProjectId) return;
    setSavingStaff(true);
    try {
      await fetch(`/api/projects/${selectedProjectId}/staff`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffIds: selectedStaffIds }),
      });
      setMsg({ type: "success", text: "✅ 担当者設定を保存しました" });
    } catch {
      setMsg({ type: "error", text: "❌ 担当者設定の保存に失敗しました" });
    } finally {
      setSavingStaff(false);
    }
  };

  // ─── 自動割り振り実行 ────────────────────────────────────
  const handleAutoAssign = async () => {
    if (!selectedProjectId || !selectedProject) return;
    if (selectedStaffIds.length === 0) {
      setMsg({ type: "error", text: "❌ 担当者を選択してから実行してください" });
      return;
    }
    if (!confirm(`「${selectedProject.name}」の自動割り振りを実行しますか？\n担当者：${selectedStaffIds.map((id) => allStaff.find((s) => s.id === id)?.name ?? "").join("、")}`)) return;

    setRunning(true);
    setMsg(null);
    try {
      // まず担当者設定を保存
      await fetch(`/api/projects/${selectedProjectId}/staff`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffIds: selectedStaffIds }),
      });

      const inspectionList = selectedBridges.map((b) => ({
        bridgeId: b.id,
        inspectionDoneDate: inspectionDates[b.id] ?? null,
      }));

      const res = await fetch("/api/assignments/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalYear, projectId: selectedProjectId, inspectionDates: inspectionList, daysAfterInspection }),
      });
      const data = await res.json();
      if (res.ok) {
        const parts: string[] = [];
        if (data.assigned > 0) parts.push(`${data.assigned}件を割り当て完了`);
        if (data.skipped > 0) parts.push(`点検完了日未入力の${data.skipped}件はスキップ`);
        if (data.unassigned > 0) parts.push(`担当者の空き不足で${data.unassigned}件を割り当てできませんでした`);
        if (data.usedAllStaff) parts.push(`担当者未設定のため全担当者（${data.staffCount}名）で実行`);
        if (data.assigned === 0 && data.skipped === 0) parts.push("割り当て対象の橋梁がありません");
        const msgType = data.unassigned > 0 || data.assigned === 0 ? "error" : "success";
        const icon = data.unassigned > 0 || data.assigned === 0 ? "⚠" : "✅";
        setMsg({ type: msgType, text: `${icon} ${parts.join("。")}` });
        if (data.unassignedBridges?.length > 0) {
          setUnassignedBridges(data.unassignedBridges);
        } else {
          setUnassignedBridges([]);
        }
        await loadData();
      } else {
        setMsg({ type: "error", text: `❌ ${data.error ?? "割り振り失敗"}` });
      }
    } catch {
      setMsg({ type: "error", text: "❌ 通信エラーが発生しました" });
    } finally {
      setRunning(false);
    }
  };

  // ─── ドラッグ・バー編集 ──────────────────────────────────
  const handleDragEnd = useCallback(async (id: number, newStart: string, newEnd: string) => {
    const res = await fetch(`/api/assignments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: newStart, endDate: newEnd }),
    });
    if (res.ok) {
      setAssignments((prev) =>
        prev.map((a) => a.id === id ? { ...a, startDate: newStart, endDate: newEnd, isManual: true } : a)
      );
    }
  }, []);

  const handleBarClick = (a: Assignment) => {
    setEditTarget(a);
    setEditForm({ startDate: a.startDate?.slice(0, 10) ?? "", endDate: a.endDate?.slice(0, 10) ?? "" });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    const res = await fetch(`/api/assignments/${editTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: editForm.startDate, endDate: editForm.endDate }),
    });
    if (res.ok) {
      setAssignments((prev) =>
        prev.map((a) => a.id === editTarget.id ? { ...a, ...editForm, isManual: true } : a)
      );
      setEditTarget(null);
    }
  };

  // ─── 連動移動 ───────────────────────────────────────────
  const handleShiftAll = async (force = false) => {
    if (!shiftDialog) return;
    const days = parseInt(shiftDays);
    if (isNaN(days) || days === 0) { setShiftDialog(null); return; }

    const res = await fetch("/api/assignments/shift-all", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: shiftDialog.staffId, fiscalYear, shiftDays: days, force }),
    });
    const data = await res.json();

    if (res.status === 409 && data.requireForce) {
      const vMsg = data.violations.map((v: any) =>
        `橋梁ID:${v.bridgeId} 制約違反（${v.limit} 以降でないといけません）`
      ).join("\n");
      if (confirm(`以下の制約違反があります。それでも移動しますか？\n\n${vMsg}`)) {
        await handleShiftAll(true);
      }
      return;
    }

    if (res.ok) {
      setMsg({ type: "success", text: `✅ ${data.updated}件の割り当てを ${days > 0 ? "+" : ""}${days}日ずらしました` });
      setShiftDialog(null);
      setShiftDays("0");
      await loadData();
    } else {
      setMsg({ type: "error", text: `❌ ${data.error ?? "移動失敗"}` });
    }
  };

  // ─── ガント（選択中業務の橋梁 + フィルター）───────────────
  const ganttBridges = selectedBridges;
  const visibleAssignments = assignments.filter((a) => {
    const inProject = ganttBridges.some((b) => b.id === a.bridgeId);
    const inStaff = filterStaffId === null || a.staffId === filterStaffId;
    return inProject && inStaff;
  });

  const prevGanttMonth = () => {
    if (ganttMonth === 1) { setGanttYear((y) => y - 1); setGanttMonth(12); }
    else setGanttMonth((m) => m - 1);
  };
  const nextGanttMonth = () => {
    if (ganttMonth === 12) { setGanttYear((y) => y + 1); setGanttMonth(1); }
    else setGanttMonth((m) => m + 1);
  };

  const monthDays = getMonthDays(ganttYear, ganttMonth);
  const staffColorMap = new Map(allStaff.map((s) => [s.id, s.color]));
  // 選択中業務の担当者オブジェクト
  const selectedStaff = allStaff.filter((s) => selectedStaffIds.includes(s.id));

  if (loading) return <div className="py-12 text-center text-gray-400">読み込み中...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">工程自動割り振り</h1>

      {msg && (
        <div
          className={`mb-4 px-4 py-3 rounded text-sm flex items-center justify-between ${msg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
        >
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-4 opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      <div className="flex gap-4">
        {/* ─── 左：業務リスト ─── */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600">年度：</label>
                <select
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(parseInt(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
                >
                  {Array.from({ length: 5 }, (_, i) => currentFY - 1 + i).map((y) => (
                    <option key={y} value={y}>{y}年度</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="py-1">
              {projects.length === 0 && (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">業務が未登録です</div>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProjectId(p.id); setFilterStaffId(null); }}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                    selectedProjectId === p.id
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.bridges.length} 橋梁</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── 右：メインコンテンツ ─── */}
        <div className="flex-1 min-w-0 space-y-4">
          {!selectedProject ? (
            <div className="bg-white rounded-lg border border-gray-200 py-12 text-center text-gray-400">
              左の業務を選択してください
            </div>
          ) : (
            <>
              {/* ─── 担当者設定パネル ─── */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-800 text-sm">
                    📁 {selectedProject.name} ― 担当者設定
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {selectedStaffIds.length === 0 ? "担当者未設定" : `${selectedStaffIds.length}名選択中`}
                    </span>
                    <button
                      onClick={handleSaveStaff}
                      disabled={savingStaff}
                      className="text-xs border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 disabled:opacity-40"
                    >
                      {savingStaff ? "保存中..." : "担当者を保存"}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allStaff.map((s) => {
                    const active = selectedStaffIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleToggleStaff(s.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          active
                            ? "text-white border-transparent"
                            : "border-gray-300 text-gray-600 hover:border-gray-400 bg-white"
                        }`}
                        style={active ? { backgroundColor: s.color, borderColor: s.color } : {}}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: s.color, opacity: active ? 0 : 1 }}
                        />
                        {s.name}
                        {active && <span className="text-xs opacity-80">✓</span>}
                      </button>
                    );
                  })}
                  {allStaff.length === 0 && (
                    <span className="text-xs text-gray-400">担当者が登録されていません</span>
                  )}
                </div>
              </div>

              {/* ─── 橋梁テーブル ─── */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h2 className="font-bold text-gray-800 text-sm">🌉 橋梁・点検完了日</h2>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* 作業開始可能日の設定 */}
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <span>点検完了日の</span>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={daysAfterInspection}
                        onChange={(e) => setDaysAfterInspection(Math.max(0, parseInt(e.target.value) || 0))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-16 text-center"
                      />
                      <span>日後から作業開始</span>
                    </div>
                    <button
                      onClick={handleAutoAssign}
                      disabled={running || selectedStaffIds.length === 0}
                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
                    >
                      {running ? "⏳ 割り振り中..." : "🔄 自動割り振り実行"}
                    </button>
                  </div>
                </div>
                {selectedStaffIds.length === 0 && (
                  <p className="text-xs text-orange-500 mb-2">⚠ 担当者が未選択です。上のパネルで担当者を選択してください（未選択の場合は全担当者で実行されます）</p>
                )}
                {selectedBridges.length > 0 && selectedBridges.every((b) => !inspectionDates[b.id]) && (
                  <p className="text-xs text-red-500 mb-2">⚠ 点検完了日が1件も入力されていません。点検完了日を入力した橋梁のみ割り振り対象になります</p>
                )}
                <div className="overflow-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-600 font-medium">橋梁名</th>
                        <th className="text-center px-3 py-2 text-gray-600 font-medium w-16">径間数</th>
                        <th className="text-center px-3 py-2 text-gray-600 font-medium w-16">係数</th>
                        <th className="text-center px-3 py-2 text-gray-600 font-medium w-24">必要時間</th>
                        <th className="text-left px-3 py-2 text-gray-600 font-medium w-40">点検完了日</th>
                        <th className="text-left px-3 py-2 text-gray-600 font-medium w-32">作業開始可能日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBridges.map((b) => {
                        const effectiveSpanCount = b.spans ?? b.spanCount;
                        const hours = effectiveSpanCount * b.spanCoefficient * 8;
                        const doneDateStr = inspectionDates[b.id] ?? "";
                        const availFrom = doneDateStr
                          ? toDateStr(addDays(new Date(doneDateStr), daysAfterInspection))
                          : "-";
                        return (
                          <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-1.5 font-medium text-gray-800">{b.name}</td>
                            <td className="px-3 py-1.5 text-center">
                              {effectiveSpanCount}
                              {b.spans != null && b.spans !== b.spanCount && (
                                <span className="text-xs text-gray-400 ml-1">(係数設定:{b.spanCount})</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-center">{b.spanCoefficient}</td>
                            <td className="px-3 py-1.5 text-center text-blue-600">{hours.toFixed(1)}h</td>
                            <td className="px-3 py-1.5">
                              <input
                                type="date"
                                value={doneDateStr}
                                onChange={(e) =>
                                  setInspectionDates((prev) => ({ ...prev, [b.id]: e.target.value }))
                                }
                                className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-gray-500 text-xs">
                              {availFrom !== "-" ? availFrom.replace(/-/g, "/") : "-"}
                            </td>
                          </tr>
                        );
                      })}
                      {selectedBridges.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-gray-400 text-sm">
                            この業務に橋梁が登録されていません
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── 割り当て不可リスト ─── */}
              {unassignedBridges.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-red-700 mb-2">⚠ 割り当てできなかった橋梁（{unassignedBridges.length}件）</h3>
                  <p className="text-xs text-red-500 mb-2">担当者のシフト上、空き時間が不足しています。点検完了日を遅らせるか、担当者のシフトを確認してください。</p>
                  <div className="space-y-1">
                    {unassignedBridges.map((b) => (
                      <div key={b.id} className="flex gap-3 text-xs text-red-700 bg-white px-3 py-1.5 rounded border border-red-100">
                        <span className="font-medium w-40 truncate">{b.name}</span>
                        <span className="text-red-400">{b.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── ガントチャート ─── */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 flex-wrap">
                  {/* 月ナビ */}
                  <div className="flex items-center gap-2">
                    <button onClick={prevGanttMonth} className="border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-50">← 前月</button>
                    <span className="font-bold text-gray-700">{ganttYear}年{ganttMonth}月</span>
                    <button onClick={nextGanttMonth} className="border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-50">翌月 →</button>
                  </div>

                  {/* 担当者フィルター（選択中業務の担当者のみ表示） */}
                  <div className="flex items-center gap-2 ml-4">
                    <label className="text-xs text-gray-500">担当者：</label>
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => setFilterStaffId(null)}
                        className={`text-xs px-2 py-1 rounded border ${filterStaffId === null ? "bg-gray-700 text-white border-gray-700" : "border-gray-300 text-gray-500 hover:bg-gray-50"}`}
                      >
                        全員
                      </button>
                      {selectedStaff.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setFilterStaffId(filterStaffId === s.id ? null : s.id)}
                          className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${filterStaffId === s.id ? "text-white border-transparent" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                          style={filterStaffId === s.id ? { backgroundColor: s.color } : {}}
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 連動移動ボタン */}
                  {filterStaffId !== null && (
                    <button
                      onClick={() => {
                        const s = allStaff.find((st) => st.id === filterStaffId);
                        if (s) setShiftDialog({ staffId: s.id, staffName: s.name });
                      }}
                      className="ml-auto text-xs border border-orange-400 text-orange-600 px-3 py-1 rounded hover:bg-orange-50"
                    >
                      📅 {allStaff.find((s) => s.id === filterStaffId)?.name} の工程を連動移動
                    </button>
                  )}
                </div>

                {/* ガント本体 */}
                <div className="overflow-x-auto">
                  {/* 日付ヘッダー */}
                  <div className="flex border-b border-gray-200" style={{ minWidth: 900 }}>
                    <div className="flex-shrink-0 bg-gray-50 border-r border-gray-200" style={{ width: 200 }}>
                      <div className="px-4 py-2 text-xs font-medium text-gray-600">橋梁名</div>
                    </div>
                    <div className="flex-1 relative bg-gray-50" style={{ minWidth: 700 }}>
                      <div className="flex">
                        {monthDays.map((d) => (
                          <div
                            key={d.getDate()}
                            className={`flex-1 text-center py-1 text-xs border-r border-gray-100 ${
                              d.getDay() === 0 || d.getDay() === 6 ? "text-red-400 bg-red-50" : "text-gray-500"
                            }`}
                            style={{ minWidth: 20 }}
                          >
                            {d.getDate()}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 橋梁行 */}
                  {ganttBridges.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                      この業務に橋梁が登録されていません
                    </div>
                  ) : ganttBridges.map((bridge) => {
                    const bridgeAssigns = visibleAssignments.filter((a) => a.bridgeId === bridge.id);
                    return (
                      <div key={bridge.id} className="flex border-b border-gray-100 hover:bg-gray-50" style={{ minWidth: 900 }}>
                        <div className="flex-shrink-0 border-r border-gray-200 px-3 py-2" style={{ width: 200 }}>
                          <div className="text-sm font-medium text-gray-800 truncate">{bridge.name}</div>
                          {bridge.serialNo && <div className="text-xs text-gray-400">{bridge.serialNo}</div>}
                        </div>
                        <div className="flex-1 relative" style={{ minWidth: 700, height: 48 }}>
                          {monthDays.map((d) =>
                            d.getDay() === 0 || d.getDay() === 6 ? (
                              <div
                                key={d.getDate()}
                                className="absolute top-0 bottom-0 bg-gray-50 opacity-60"
                                style={{
                                  left: `${((d.getDate() - 1) / monthDays.length) * 100}%`,
                                  width: `${(1 / monthDays.length) * 100}%`,
                                }}
                              />
                            ) : null
                          )}
                          {inspectionDates[bridge.id] && (
                            <InspectionFlag date={inspectionDates[bridge.id]} year={ganttYear} month={ganttMonth} />
                          )}
                          {bridgeAssigns.map((a) => (
                            <AssignmentBar
                              key={a.id}
                              assignment={a}
                              year={ganttYear}
                              month={ganttMonth}
                              staffColor={staffColorMap.get(a.staffId) ?? "#378ADD"}
                              onDragEnd={handleDragEnd}
                              onClick={handleBarClick}
                            />
                          ))}
                          {bridgeAssigns.length === 0 && (
                            <div className="absolute inset-0 flex items-center px-3">
                              <span className="text-xs text-gray-300">未割り当て</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 凡例 */}
                {selectedStaff.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-4">
                    {selectedStaff.map((s) => (
                      <div key={s.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="w-4 h-3 rounded inline-block" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      🚩 点検完了日　✏️ 手動修正済み
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── 連動移動ダイアログ ─── */}
      {shiftDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setShiftDialog(null)}>
          <div className="bg-white rounded-lg shadow-xl w-80 mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-1">連動移動</h3>
            <p className="text-xs text-gray-500 mb-4">{shiftDialog.staffName} の全割り当てをずらします</p>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                value={shiftDays}
                onChange={(e) => setShiftDays(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-24 text-center"
                placeholder="日数"
              />
              <span className="text-sm text-gray-600">日ずらす（マイナスで前倒し）</span>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShiftDialog(null)} className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50">キャンセル</button>
              <button
                onClick={() => handleShiftAll(false)}
                disabled={shiftDays === "0" || shiftDays === ""}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-40"
              >
                実行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── バー編集ダイアログ ─── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setEditTarget(null)}>
          <div className="bg-white rounded-lg shadow-xl w-96 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-800 text-sm">{editTarget.bridge.name}</p>
                <p className="text-xs text-gray-400">{editTarget.staff.name} / {editTarget.bridge.project.name}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">開始日</label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">終了日</label>
                  <input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                  />
                </div>
              </div>
              {editTarget.isManual && (
                <p className="text-xs text-orange-500">✏️ 手動修正済みの割り当てです</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setEditTarget(null)} className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50">キャンセル</button>
              <button onClick={handleEditSave} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
