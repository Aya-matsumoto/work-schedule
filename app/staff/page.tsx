"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import GanttBar from "@/components/GanttBar";
import StaffProcessCreateModal from "@/components/StaffProcessCreateModal";
import ProcessEditModal from "@/components/ProcessEditModal";
import {
  currentMonth, prevMonth, nextMonth, parseYearMonth,
  getDaysInMonth, getMonthSequence, calcMultiMonthBar, isWeekend,
} from "@/lib/utils";

interface ProcessRecord {
  id: number;
  processTypeId: number;
  processType: { id: number; name: string; color: string };
  staffId: number | null;
  staffMembers?: { staffId: number; staff: { id: number; name: string } }[];
  status: string;
  startDate: string | null;
  endDate: string | null;
  completedDate: string | null;
  note: string | null;
  bridge: { id: number; name: string; project: { id: number; name: string } } | null;
  project: { id: number; name: string } | null;
}

interface EditTarget {
  record: ProcessRecord;
  bridgeName: string;
  projectName: string;
}

interface StaffAssignment {
  id: number;
  startDate: string | null;
  endDate: string | null;
  isManual: boolean;
  processType: { id: number; name: string; color: string } | null;
  bridge: { id: number; name: string; project: { id: number; name: string } };
}

interface StaffWithSchedule {
  id: number;
  name: string;
  color: string;
  processes: ProcessRecord[];
  assignments: StaffAssignment[];
}

interface Bridge { id: number; name: string; }
interface Project { id: number; name: string; bridges: Bridge[]; }
interface ProcessType { id: number; name: string; color: string; order: number; }

interface CreateTarget {
  staffId: number;
  staffName: string;
  initialDate?: string;
}

const DAY_WIDTH = 26;
const MONTH_COUNT = 3;
const LABEL_WIDTH = 140;

export default function StaffPage() {
  const [month, setMonth] = useState(currentMonth());
  const [checkDate, setCheckDate] = useState("");
  const [staffList, setStaffList] = useState<StaffWithSchedule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [loading, setLoading] = useState(false);
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [staffFilterOpen, setStaffFilterOpen] = useState(false);

  const ganttContentRef = useRef<HTMLDivElement>(null);
  const ganttScrollbarRef = useRef<HTMLDivElement>(null);
  const staffFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (staffFilterRef.current && !staffFilterRef.current.contains(e.target as Node)) {
        setStaffFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { year, month: monthNum } = parseYearMonth(month);

  const months = useMemo(() => getMonthSequence(month, MONTH_COUNT), [month]);
  const totalDays = useMemo(
    () => months.reduce((s, m) => s + getDaysInMonth(m.year, m.month), 0),
    [months]
  );
  const timelineWidth = totalDays * DAY_WIDTH;

  const filteredStaffList = useMemo(
    () => selectedStaffIds.length === 0 ? staffList : staffList.filter((s) => selectedStaffIds.includes(s.id)),
    [staffList, selectedStaffIds]
  );

  // 最終月のYYYY-MM（APIのendMonth用）
  const endMonth = months[months.length - 1].ym;

  const barPx = useCallback(
    (start: string | null | undefined, end: string | null | undefined) =>
      calcMultiMonthBar(start, end, month, totalDays, DAY_WIDTH),
    [month, totalDays]
  );

  // 土日・祝日・今日の背景セル
  const bgCells = useMemo(() => {
    const holidaySet = new Set(holidays.map((h) => h.slice(0, 10)));
    const today = new Date().toISOString().slice(0, 10);
    const cells: Array<{ off: boolean; holiday: boolean; isToday: boolean }> = [];
    for (const m of months) {
      const days = getDaysInMonth(m.year, m.month);
      for (let d = 1; d <= days; d++) {
        const mm = String(m.month).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        const dateStr = `${m.year}-${mm}-${dd}`;
        const off = isWeekend(m.year, m.month, d);
        const holiday = holidaySet.has(dateStr);
        cells.push({ off, holiday, isToday: dateStr === today });
      }
    }
    return cells;
  }, [months, holidays]);

  // スクロール同期
  const handleGanttScroll = useCallback(() => {
    if (ganttScrollbarRef.current && ganttContentRef.current) {
      ganttScrollbarRef.current.scrollLeft = ganttContentRef.current.scrollLeft;
    }
  }, []);
  const handleScrollbarScroll = useCallback(() => {
    if (ganttContentRef.current && ganttScrollbarRef.current) {
      ganttContentRef.current.scrollLeft = ganttScrollbarRef.current.scrollLeft;
    }
  }, []);

  const loadSchedule = useCallback(() => {
    setLoading(true);
    fetch(`/api/staff/schedule?month=${month}&endMonth=${endMonth}`)
      .then((r) => r.json())
      .then((data) => { setStaffList(Array.isArray(data) ? data : []); setLoading(false); });
  }, [month, endMonth]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  // 業務・工程種別・休日を初回ロード
  useEffect(() => {
    Promise.all([
      fetch(`/api/gantt/dashboard?month=${month}`).then((r) => r.json()),
      fetch("/api/process-types").then((r) => r.json()),
      fetch("/api/holidays").then((r) => r.json()),
    ]).then(([projectsData, typesData, holidaysData]) => {
      if (Array.isArray(projectsData)) {
        setProjects(projectsData.map((p: any) => ({
          id: p.id, name: p.name,
          bridges: p.bridges?.map((b: any) => ({ id: b.id, name: b.name })) ?? [],
        })));
      }
      if (Array.isArray(typesData)) {
        setProcessTypes([...typesData].sort((a, b) => a.order - b.order));
      }
      if (Array.isArray(holidaysData)) {
        setHolidays(holidaysData.map((h: any) => h.date));
      }
    });
  }, [month]);

  // ガントエリアクリック → 日付を計算
  const handleGridClick = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    staffId: number,
    staffName: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const dayIndex = Math.floor(relativeX / DAY_WIDTH);
    const { year: sy, month: sm } = parseYearMonth(month);
    const timelineStart = new Date(sy, sm - 1, 1);
    const clickedDate = new Date(timelineStart.getTime() + dayIndex * 86400000);
    const yyyy = clickedDate.getFullYear();
    const mm = String(clickedDate.getMonth() + 1).padStart(2, "0");
    const dd = String(clickedDate.getDate()).padStart(2, "0");
    setCreateTarget({ staffId, staffName, initialDate: `${yyyy}-${mm}-${dd}` });
  }, [month]);

  // 予定を登録
  const handleCreateSave = useCallback(async (data: {
    staffId: number;
    projectId?: number;
    bridgeId?: number;
    processTypeId: number;
    startDate: string | null;
    endDate: string | null;
    note: string | null;
  }) => {
    setCreateTarget(null);
    try {
      const url = data.bridgeId
        ? `/api/bridges/${data.bridgeId}/processes`
        : `/api/projects/${data.projectId}/processes`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processTypeId: data.processTypeId,
          staffId: data.staffId,
          startDate: data.startDate,
          endDate: data.endDate,
          note: data.note,
        }),
      });
      loadSchedule();
    } catch { loadSchedule(); }
  }, [loadSchedule]);

  // 工程バークリック → 編集
  const handleProcessBarClick = useCallback((recordId: number) => {
    for (const s of staffList) {
      const proc = s.processes.find((p) => p.id === recordId);
      if (proc) {
        const bridgeName = proc.bridge?.name ?? proc.project?.name ?? "";
        const projectName = proc.bridge?.project?.name ?? proc.project?.name ?? "";
        setEditTarget({ record: proc, bridgeName, projectName });
        return;
      }
    }
  }, [staffList]);

  // 工程バードラッグ → 日程更新
  const handleProcessDragEnd = useCallback(async (recordId: number, newStart: string, newEnd: string) => {
    setStaffList((prev) => prev.map((s) => ({
      ...s,
      processes: s.processes.map((p) =>
        p.id === recordId ? { ...p, startDate: newStart, endDate: newEnd } : p
      ),
    })));
    try {
      const allProcs = staffList.flatMap((s) => s.processes);
      const rec = allProcs.find((p) => p.id === recordId);
      const staffIds = rec?.staffMembers && rec.staffMembers.length > 0
        ? rec.staffMembers.map((sm) => sm.staffId)
        : rec?.staffId ? [rec.staffId] : [];
      await fetch(`/api/processes/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffIds, startDate: newStart, endDate: newEnd,
          completedDate: rec?.completedDate ?? null,
          note: rec?.note ?? null,
          status: rec?.status ?? "IN_PROGRESS",
        }),
      });
    } catch { loadSchedule(); }
  }, [staffList, loadSchedule]);

  // 工程編集モーダル保存
  const handleProcessSave = useCallback(async (data: {
    id: number; staffIds: number[];
    startDate: string | null; endDate: string | null;
    completedDate: string | null; note: string | null;
  }) => {
    setEditTarget(null);
    const status = data.completedDate ? "COMPLETED" : data.startDate ? "IN_PROGRESS" : "NOT_STARTED";
    try {
      await fetch(`/api/processes/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffIds: data.staffIds, startDate: data.startDate, endDate: data.endDate, completedDate: data.completedDate, note: data.note, status }),
      });
      loadSchedule();
    } catch { loadSchedule(); }
  }, [loadSchedule]);

  function isAvailable(s: StaffWithSchedule): boolean {
    if (!checkDate) return false;
    const d = new Date(checkDate);
    return s.processes.every((p) => {
      if (!p.startDate) return true;
      const start = new Date(p.startDate);
      const end = p.endDate ? new Date(p.endDate) : start;
      return d < start || d > end;
    });
  }

  function getLabel(proc: ProcessRecord): string {
    const projectName = proc.bridge?.project?.name ?? proc.project?.name ?? "";
    return `${projectName} / ${proc.processType.name}`;
  }

  return (
    <div className="d3-body">
      <div className="d3-headrow">
        <div>
          <h1 className="d3-h1">担当者<span className="em">稼働状況</span></h1>
          <div className="d3-hsub">担当者ごとの稼働を確認し、空き状況から予定を追加できます</div>
        </div>
      </div>

      {/* 月ナビ & 空き確認 */}
      <div className="d3-subrow">
        <div className="d3-month">
          <button className="d3-mbtn" onClick={() => setMonth(prevMonth(month))}>← 前月</button>
          <button className="d3-mbtn" onClick={() => setMonth(currentMonth())}>今月</button>
          <span className="d3-mtitle">
            <span className="curr">{year}年{monthNum}月</span>
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, marginLeft: 6 }}>
              〜 {months[months.length - 1].year}年{months[months.length - 1].month}月（3ヶ月）
            </span>
          </span>
          <button className="d3-mbtn" onClick={() => setMonth(nextMonth(month))}>翌月 →</button>
        </div>
        <div className="d3-inlinedate">
          <span>空き確認日</span>
          <span className="d3-datebox">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>
            <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
          </span>
          {checkDate && <button className="d3-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setCheckDate("")}>クリア</button>}
        </div>
        {/* 担当者フィルター */}
        <div ref={staffFilterRef} style={{ position: "relative" }}>
          <button
            onClick={() => setStaffFilterOpen((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #D1D5DB", borderRadius: 6, background: selectedStaffIds.length > 0 ? "#EEF2FF" : "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: selectedStaffIds.length > 0 ? "#4F46E5" : "var(--ink)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            担当者{selectedStaffIds.length > 0 ? `（${selectedStaffIds.length}名）` : ""}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {staffFilterOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200, background: "white", border: "1px solid #E2E4EE", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 180, maxHeight: 320, overflowY: "auto", padding: "6px 0" }}>
              <div style={{ padding: "4px 12px 6px", borderBottom: "1px solid #F1F3F9", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>担当者を絞り込む</span>
                {selectedStaffIds.length > 0 && (
                  <button onClick={() => setSelectedStaffIds([])} style={{ fontSize: 11, color: "#4F46E5", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>クリア</button>
                )}
              </div>
              {staffList.map((s) => {
                const checked = selectedStaffIds.includes(s.id);
                return (
                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", cursor: "pointer", background: checked ? "#F5F3FF" : undefined }}>
                    <input type="checkbox" checked={checked} onChange={() => setSelectedStaffIds((prev) => checked ? prev.filter((id) => id !== s.id) : [...prev, s.id])} style={{ accentColor: "#4F46E5" }} />
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{s.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>ガントの空欄をクリックすると予定を追加できます</span>
      </div>

      {loading ? (
        <div className="d3-placeholder"><div className="pi">⏳</div><b>読み込み中...</b></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", borderRadius: 8, border: "1px solid #E2E4EE", overflow: "hidden" }}>
          {/* メインスクロールコンテナ（縦横両方） */}
          <div
            ref={ganttContentRef}
            onScroll={handleGanttScroll}
            className="no-scrollbar"
            style={{ overflow: "auto" }}
          >
            <div style={{ minWidth: LABEL_WIDTH + timelineWidth }}>

              {/* 月ヘッダー（sticky top:0） */}
              <div style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", background: "var(--surface, #F7F8FC)", borderBottom: "2px solid #E2E4EE" }}>
                <div style={{ width: LABEL_WIDTH, flexShrink: 0, position: "sticky", left: 0, zIndex: 31, background: "var(--surface, #F7F8FC)", borderRight: "1px solid #E2E4EE" }} />
                {months.map((m) => (
                  <div key={m.ym} style={{ width: getDaysInMonth(m.year, m.month) * DAY_WIDTH, flexShrink: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--ink)", padding: "5px 0", borderRight: "1px solid #E2E4EE", borderLeft: "1px solid #C5C8D8" }}>
                    {m.year}年{m.month}月
                  </div>
                ))}
              </div>

              {/* 日ヘッダー（sticky top:28） */}
              <div style={{ position: "sticky", top: 28, zIndex: 30, display: "flex", background: "var(--surface, #F7F8FC)", borderBottom: "1px solid #E2E4EE" }}>
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

              {/* 担当者行 */}
              {filteredStaffList.map((s) => {
                const available = isAvailable(s);
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #F1F3F9", minHeight: 44, background: available ? "#F0FDF4" : undefined }}>
                    {/* 担当者名（sticky left:0） */}
                    <div style={{ width: LABEL_WIDTH, flexShrink: 0, position: "sticky", left: 0, zIndex: 15, background: available ? "#F0FDF4" : "white", borderRight: "1px solid #E2E4EE", display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                        {available && <div style={{ fontSize: 11, color: "#179C5B", fontWeight: 700 }}>✅ 空き</div>}
                        {!available && checkDate && <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>予定あり</div>}
                      </div>
                    </div>

                    {/* ガントエリア */}
                    <div
                      style={{ position: "relative", width: timelineWidth, height: 44, flexShrink: 0, cursor: "cell" }}
                      onClick={(e) => handleGridClick(e, s.id, s.name)}
                    >
                      {/* 背景（土日・祝日） */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {bgCells.map((cell, i) => <div key={i} style={{ width: DAY_WIDTH, flexShrink: 0, height: "100%", background: cell.holiday ? "rgba(254,226,226,0.5)" : cell.off ? "rgba(0,0,0,0.025)" : undefined }} />)}
                      </div>
                      {/* 今日線 */}
                      {bgCells.map((cell, i) => cell.isToday ? <div key="today" className="absolute top-0 bottom-0 pointer-events-none z-10" style={{ left: (i + 0.5) * DAY_WIDTH, width: 1, background: "#F87171" }} /> : null)}
                      {/* 月区切り線 */}
                      {(() => { let offset = 0; return months.slice(0, -1).map((m) => { offset += getDaysInMonth(m.year, m.month) * DAY_WIDTH; return <div key={m.ym} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: offset, width: 1, background: "#C5C8D8" }} />; }); })()}

                      {/* 自動割り振りバー */}
                      {s.assignments?.map((a) => {
                        const px = barPx(a.startDate, a.endDate);
                        if (!px) return null;
                        return (
                          <GanttBar
                            key={`assign-${a.id}`}
                            id={a.id}
                            startDate={a.startDate}
                            endDate={a.endDate}
                            color={a.processType?.color ?? s.color}
                            processName={a.processType?.name ?? "工数割り振り"}
                            customLabel={a.isManual ? `${a.bridge.name} ✏` : `${a.bridge.name} 📋`}
                            year={year} month={monthNum}
                            pixelLeft={px.left} pixelWidth={px.width} dayWidth={DAY_WIDTH}
                          />
                        );
                      })}

                      {/* 工程バー */}
                      {s.processes.map((proc) => {
                        const px = barPx(proc.startDate, proc.endDate);
                        if (!px) return null;
                        return (
                          <GanttBar
                            key={proc.id}
                            id={proc.id}
                            startDate={proc.startDate}
                            endDate={proc.endDate}
                            completedDate={proc.completedDate}
                            color={proc.processType.color}
                            processName={proc.processType.name}
                            customLabel={getLabel(proc)}
                            year={year} month={monthNum}
                            pixelLeft={px.left} pixelWidth={px.width} dayWidth={DAY_WIDTH}
                            onClick={handleProcessBarClick}
                            onDragEnd={handleProcessDragEnd}
                          />
                        );
                      })}

                      {s.processes.length === 0 && !s.assignments?.length && (
                        <span className="d3-empty" style={{ pointerEvents: "none" }}>＋ クリックして予定を追加</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 常時表示の横スクロールバー */}
          <div
            ref={ganttScrollbarRef}
            onScroll={handleScrollbarScroll}
            style={{ overflowX: "auto", overflowY: "hidden", flexShrink: 0, borderTop: "1px solid #E2E4EE" }}
          >
            <div style={{ width: LABEL_WIDTH + timelineWidth, height: 1 }} />
          </div>
        </div>
      )}

      {/* 予定追加モーダル */}
      {createTarget && (
        <StaffProcessCreateModal
          staffId={createTarget.staffId}
          staffName={createTarget.staffName}
          projects={projects}
          processTypes={processTypes}
          initialDate={createTarget.initialDate}
          onSave={handleCreateSave}
          onClose={() => setCreateTarget(null)}
        />
      )}

      {/* 工程編集モーダル */}
      {editTarget && (
        <ProcessEditModal
          record={editTarget.record}
          staff={staffList.map((s) => ({ id: s.id, name: s.name }))}
          bridgeName={editTarget.bridgeName}
          projectName={editTarget.projectName}
          onSave={handleProcessSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
