"use client";

import { useEffect, useState, useCallback } from "react";
import GanttGrid from "@/components/GanttGrid";
import GanttBar from "@/components/GanttBar";
import StaffProcessCreateModal from "@/components/StaffProcessCreateModal";
import ProcessEditModal from "@/components/ProcessEditModal";
import { currentMonth, prevMonth, nextMonth, parseYearMonth } from "@/lib/utils";

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

export default function StaffPage() {
  const [month, setMonth] = useState(currentMonth());
  const [checkDate, setCheckDate] = useState("");
  const [staffList, setStaffList] = useState<StaffWithSchedule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [loading, setLoading] = useState(false);
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const { year, month: monthNum } = parseYearMonth(month);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const loadSchedule = useCallback(() => {
    setLoading(true);
    fetch(`/api/staff/schedule?month=${month}`)
      .then((r) => r.json())
      .then((data) => { setStaffList(Array.isArray(data) ? data : []); setLoading(false); });
  }, [month]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  // 業務・工程種別を初回ロード
  useEffect(() => {
    Promise.all([
      fetch(`/api/gantt/dashboard?month=${month}`).then((r) => r.json()),
      fetch("/api/process-types").then((r) => r.json()),
    ]).then(([projectsData, typesData]) => {
      if (Array.isArray(projectsData)) {
        setProjects(projectsData.map((p: any) => ({
          id: p.id,
          name: p.name,
          bridges: p.bridges?.map((b: any) => ({ id: b.id, name: b.name })) ?? [],
        })));
      }
      if (Array.isArray(typesData)) {
        setProcessTypes([...typesData].sort((a, b) => a.order - b.order));
      }
    });
  }, [month]);

  // ガントグリッドのクリック → クリックした日付を計算
  const handleGridClick = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    staffId: number,
    staffName: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const dayFraction = relativeX / rect.width;
    const dayIndex = Math.floor(dayFraction * daysInMonth);
    const clickedDate = new Date(year, monthNum - 1, dayIndex + 1);
    const yyyy = clickedDate.getFullYear();
    const mm = String(clickedDate.getMonth() + 1).padStart(2, "0");
    const dd = String(clickedDate.getDate()).padStart(2, "0");
    setCreateTarget({ staffId, staffName, initialDate: `${yyyy}-${mm}-${dd}` });
  }, [year, monthNum, daysInMonth]);

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
    } catch {
      loadSchedule();
    }
  }, [loadSchedule]);

  // 工程バーをクリック → 編集モーダルを開く
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

  // 工程バーのドラッグ → 日程更新
  const handleProcessDragEnd = useCallback(async (recordId: number, newStart: string, newEnd: string) => {
    // 画面を即時更新
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
          staffIds,
          startDate: newStart,
          endDate: newEnd,
          completedDate: rec?.completedDate ?? null,
          note: rec?.note ?? null,
          status: rec?.status ?? "IN_PROGRESS",
        }),
      });
    } catch { loadSchedule(); }
  }, [staffList, loadSchedule]);

  // 工程編集モーダル 保存
  const handleProcessSave = useCallback(async (data: {
    id: number;
    staffIds: number[];
    startDate: string | null;
    endDate: string | null;
    completedDate: string | null;
    note: string | null;
  }) => {
    setEditTarget(null);
    const status = data.completedDate
      ? "COMPLETED"
      : data.startDate
      ? "IN_PROGRESS"
      : "NOT_STARTED";
    try {
      await fetch(`/api/processes/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffIds: data.staffIds, startDate: data.startDate, endDate: data.endDate, completedDate: data.completedDate, note: data.note, status }),
      });
      // 担当者変更でバーの表示が変わるため再ロード
      loadSchedule();
    } catch { loadSchedule(); }
  }, [loadSchedule]);

  // 空き確認：指定日に予定がない担当者を判定
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

  // ガントバーのラベル（業務名/工程名）
  function getLabel(proc: ProcessRecord): string {
    const projectName = proc.bridge?.project?.name ?? proc.project?.name ?? "";
    return `${projectName} / ${proc.processType.name}`;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-5">担当者稼働状況</h1>

      {/* 月ナビ & 空き確認 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button onClick={() => setMonth(prevMonth(month))} className="border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-50">← 前月</button>
        <button onClick={() => setMonth(currentMonth())} className="border border-gray-300 rounded px-3 py-1 text-sm text-blue-600 font-medium hover:bg-gray-50">今月</button>
        <span className="font-bold text-gray-700 text-lg">{year}年{monthNum}月</span>
        <button onClick={() => setMonth(nextMonth(month))} className="border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-50">翌月 →</button>

        <div className="ml-4 flex items-center gap-2">
          <label className="text-sm text-gray-600">空き確認日：</label>
          <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="border border-gray-300 rounded px-3 py-1 text-sm" />
          {checkDate && <button onClick={() => setCheckDate("")} className="text-sm text-gray-400 hover:text-gray-600">クリア</button>}
        </div>

        <p className="text-xs text-gray-400 ml-2">ガントの空欄をクリックすると予定を追加できます</p>
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {staffList.map((s) => {
            const available = isAvailable(s);
            return (
              <div
                key={s.id}
                className={`flex items-stretch border-b border-gray-100 last:border-0 ${available ? "bg-green-50" : ""}`}
              >
                {/* 担当者名 */}
                <div className="flex items-center px-4 py-2" style={{ minWidth: 100, maxWidth: 100 }}>
                  <div>
                    <div className="text-sm font-medium text-gray-700">{s.name}</div>
                    {available && <div className="text-xs text-green-600">✅ 空き</div>}
                    {!available && checkDate && <div className="text-xs text-gray-400">予定あり</div>}
                  </div>
                </div>
                {/* ガントチャート */}
                <div className="flex-1 border-l border-gray-100">
                  <GanttGrid year={year} month={monthNum}>
                    <div
                      className="relative cursor-cell"
                      style={{ height: 40 }}
                      onClick={(e) => handleGridClick(e, s.id, s.name)}
                    >
                      {/* 自動割り振りバー */}
                      {s.assignments?.map((a) => (
                        <GanttBar
                          key={`assign-${a.id}`}
                          id={a.id}
                          startDate={a.startDate}
                          endDate={a.endDate}
                          color={s.color}
                          processName="工数割り振り"
                          customLabel={`📋 ${a.bridge.name}${a.isManual ? " ✏" : ""}`}
                          year={year}
                          month={monthNum}
                        />
                      ))}
                      {/* 工程バー */}
                      {s.processes.map((proc) => (
                        <GanttBar
                          key={proc.id}
                          id={proc.id}
                          startDate={proc.startDate}
                          endDate={proc.endDate}
                          completedDate={proc.completedDate}
                          color={proc.processType.color}
                          processName={proc.processType.name}
                          customLabel={getLabel(proc)}
                          year={year}
                          month={monthNum}
                          onClick={handleProcessBarClick}
                          onDragEnd={handleProcessDragEnd}
                        />
                      ))}
                      {s.processes.length === 0 && !s.assignments?.length && (
                        <div className="absolute inset-0 flex items-center px-3">
                          <span className="text-xs text-gray-300">クリックして予定を追加</span>
                        </div>
                      )}
                    </div>
                  </GanttGrid>
                </div>
              </div>
            );
          })}
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
