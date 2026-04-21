"use client";

import { useEffect, useState } from "react";
import GanttGrid from "@/components/GanttGrid";
import GanttBar from "@/components/GanttBar";
import { currentMonth, prevMonth, nextMonth, parseYearMonth, formatDate } from "@/lib/utils";

interface ProcessRecord {
  id: number;
  startDate: string | null;
  endDate: string | null;
  completedDate: string | null;
  processType: { name: string; color: string };
  bridge: { id: number; name: string; project: { name: string } };
}

interface StaffWithSchedule {
  id: number;
  name: string;
  color: string;
  processes: ProcessRecord[];
}

export default function StaffPage() {
  const [month, setMonth] = useState(currentMonth());
  const [checkDate, setCheckDate] = useState("");
  const [staffList, setStaffList] = useState<StaffWithSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const { year, month: monthNum } = parseYearMonth(month);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/staff/schedule?month=${month}`)
      .then((r) => r.json())
      .then((data) => { setStaffList(data); setLoading(false); });
  }, [month]);

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
                    <div className="relative" style={{ height: 40 }}>
                      {s.processes.map((proc) => (
                        <GanttBar
                          key={proc.id}
                          id={proc.id}
                          startDate={proc.startDate}
                          endDate={proc.endDate}
                          completedDate={proc.completedDate}
                          color={proc.processType.color}
                          processName={proc.processType.name}
                          customLabel={`${proc.bridge.project.name} / ${proc.processType.name}`}
                          year={year}
                          month={monthNum}
                        />
                      ))}
                      {s.processes.length === 0 && (
                        <div className="absolute inset-0 flex items-center px-3">
                          <span className="text-xs text-gray-300">予定なし</span>
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
    </div>
  );
}
