"use client";
import { useEffect, useState, useCallback } from "react";

const DAYS = [
  { key: "mon", label: "月" },
  { key: "tue", label: "火" },
  { key: "wed", label: "水" },
  { key: "thu", label: "木" },
  { key: "fri", label: "金" },
  { key: "sat", label: "土" },
  { key: "sun", label: "日" },
];
const DEFAULT_PATTERN = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };

interface Staff { id: number; name: string; color: string; }
interface ShiftOverride { id: number; date: string; hoursPerDay: number; note: string | null; }
interface StaffShift {
  id: number;
  staffId: number;
  defaultHoursPerDay: number;
  weekPattern: Record<string, boolean>;
  validFrom: string;
  overrides: ShiftOverride[];
}

interface ShiftForm {
  defaultHoursPerDay: string;
  weekPattern: Record<string, boolean>;
  validFrom: string;
  dirty: boolean;
}

export default function ShiftSettingsPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Record<number, StaffShift | null>>({});
  const [forms, setForms] = useState<Record<number, ShiftForm>>({});
  const [overrides, setOverrides] = useState<Record<number, ShiftOverride[]>>({});
  const [overrideInputs, setOverrideInputs] = useState<Record<number, { date: string; hours: string; note: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [staffRes, shiftRes] = await Promise.all([
      fetch("/api/staff").then((r) => r.json()),
      fetch("/api/shifts").then((r) => r.json()),
    ]);
    const slist: Staff[] = Array.isArray(staffRes) ? staffRes : [];
    const sdata: StaffShift[] = Array.isArray(shiftRes) ? shiftRes : [];

    setStaffList(slist);

    const shiftMap: Record<number, StaffShift | null> = {};
    const formMap: Record<number, ShiftForm> = {};
    const ovMap: Record<number, ShiftOverride[]> = {};
    const ovInputMap: Record<number, { date: string; hours: string; note: string }> = {};

    for (const s of slist) {
      const shift = sdata.find((sh) => sh.staffId === s.id) ?? null;
      shiftMap[s.id] = shift;
      formMap[s.id] = {
        defaultHoursPerDay: shift ? String(shift.defaultHoursPerDay) : "8",
        weekPattern: shift ? (shift.weekPattern as Record<string, boolean>) : { ...DEFAULT_PATTERN },
        validFrom: shift ? shift.validFrom.slice(0, 10) : new Date().toISOString().slice(0, 10),
        dirty: false,
      };
      ovMap[s.id] = shift?.overrides ?? [];
      ovInputMap[s.id] = { date: "", hours: "0", note: "" };
    }

    setShifts(shiftMap);
    setForms(formMap);
    setOverrides(ovMap);
    setOverrideInputs(ovInputMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFormChange = (staffId: number, field: keyof ShiftForm, value: unknown) => {
    setForms((prev) => ({
      ...prev,
      [staffId]: { ...prev[staffId], [field]: value, dirty: true },
    }));
  };

  const handleDayToggle = (staffId: number, day: string) => {
    const current = forms[staffId]?.weekPattern ?? { ...DEFAULT_PATTERN };
    handleFormChange(staffId, "weekPattern", { ...current, [day]: !current[day] });
  };

  const handleSaveShift = async (staffId: number) => {
    const form = forms[staffId];
    setSaving(staffId);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId,
          defaultHoursPerDay: form.defaultHoursPerDay,
          weekPattern: form.weekPattern,
          validFrom: form.validFrom,
        }),
      });
      if (res.ok) {
        setForms((prev) => ({ ...prev, [staffId]: { ...prev[staffId], dirty: false } }));
        await load();
      }
    } finally {
      setSaving(null);
    }
  };

  const handleAddOverride = async (staffId: number) => {
    const input = overrideInputs[staffId];
    if (!input.date) return;
    setSaving(staffId);
    try {
      const res = await fetch(`/api/shifts/${staffId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: input.date,
          hoursPerDay: parseFloat(input.hours) || 0,
          note: input.note || null,
        }),
      });
      if (res.ok) {
        setOverrideInputs((prev) => ({ ...prev, [staffId]: { date: "", hours: "0", note: "" } }));
        await load();
      }
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteOverride = async (staffId: number, ovId: number) => {
    if (!confirm("この個別変更を削除しますか？")) return;
    await fetch(`/api/shifts/overrides/${ovId}`, { method: "DELETE" });
    await load();
  };

  if (loading) return <div className="py-8 text-center text-gray-400">読み込み中...</div>;

  return (
    <div className="d3-body">
      <div className="d3-headrow">
        <div>
          <h1 className="d3-h1">担当者シフト・<span className="em">勤務時間設定</span></h1>
          <div className="d3-hsub">担当者ごとの出勤曜日と1日の勤務時間を設定します。</div>
        </div>
      </div>

      <div className="space-y-4">
        {staffList.map((staff) => {
          const form = forms[staff.id];
          const ovList = overrides[staff.id] ?? [];
          const ovInput = overrideInputs[staff.id] ?? { date: "", hours: "0", note: "" };
          const isExpanded = expandedId === staff.id;

          return (
            <div key={staff.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* ヘッダー */}
              <div
                className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(isExpanded ? null : staff.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: staff.color }} />
                  <span className="font-medium text-gray-800">{staff.name}</span>
                  {form && (
                    <span className="text-xs text-gray-400">
                      {DAYS.filter((d) => form.weekPattern[d.key]).map((d) => d.label).join("・")} ／ {form.defaultHoursPerDay}時間/日
                    </span>
                  )}
                </div>
                <span className="text-gray-400 text-sm">{isExpanded ? "▲" : "▼"}</span>
              </div>

              {isExpanded && form && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-5">
                  {/* 週間パターン */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">出勤曜日</label>
                    <div className="flex gap-2">
                      {DAYS.map((d) => (
                        <button
                          key={d.key}
                          onClick={() => handleDayToggle(staff.id, d.key)}
                          className={`w-9 h-9 rounded text-sm font-medium border transition-colors ${
                            form.weekPattern[d.key]
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-400 border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 勤務時間 & 適用開始日 */}
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">1日の標準勤務時間</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="24"
                          step="0.5"
                          value={form.defaultHoursPerDay}
                          onChange={(e) => handleFormChange(staff.id, "defaultHoursPerDay", e.target.value)}
                          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-24"
                        />
                        <span className="text-sm text-gray-500">時間</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">適用開始日</label>
                      <input
                        type="date"
                        value={form.validFrom}
                        onChange={(e) => handleFormChange(staff.id, "validFrom", e.target.value)}
                        className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => handleSaveShift(staff.id)}
                      disabled={!form.dirty || saving === staff.id}
                      className="bg-blue-600 text-white px-5 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-40"
                    >
                      {saving === staff.id ? "保存中..." : "シフトを保存"}
                    </button>
                  </div>

                  {/* 個別変更 */}
                  <div className="border-t border-gray-100 pt-4">
                    <h3 className="text-xs font-medium text-gray-600 mb-3">個別勤務時間変更（特定日のみ）</h3>

                    {ovList.length > 0 && (
                      <div className="mb-3 space-y-1">
                        {ovList.map((ov) => (
                          <div key={ov.id} className="flex items-center gap-3 text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded">
                            <span className="w-28">{ov.date.slice(0, 10)}</span>
                            <span className="w-20">{ov.hoursPerDay === 0 ? "休み" : `${ov.hoursPerDay} 時間`}</span>
                            <span className="flex-1 text-gray-400">{ov.note ?? ""}</span>
                            <button
                              onClick={() => handleDeleteOverride(staff.id, ov.id)}
                              className="text-gray-300 hover:text-red-500 text-xs"
                            >
                              削除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 items-end">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">日付</label>
                        <input
                          type="date"
                          value={ovInput.date}
                          onChange={(e) =>
                            setOverrideInputs((prev) => ({ ...prev, [staff.id]: { ...prev[staff.id], date: e.target.value } }))
                          }
                          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">勤務時間（0=休み）</label>
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          value={ovInput.hours}
                          onChange={(e) =>
                            setOverrideInputs((prev) => ({ ...prev, [staff.id]: { ...prev[staff.id], hours: e.target.value } }))
                          }
                          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-24"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">メモ（任意）</label>
                        <input
                          type="text"
                          value={ovInput.note}
                          onChange={(e) =>
                            setOverrideInputs((prev) => ({ ...prev, [staff.id]: { ...prev[staff.id], note: e.target.value } }))
                          }
                          placeholder="例：半日勤務"
                          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-36"
                        />
                      </div>
                      <button
                        onClick={() => handleAddOverride(staff.id)}
                        disabled={!ovInput.date || saving === staff.id}
                        className="border border-blue-500 text-blue-600 px-4 py-1.5 rounded text-sm hover:bg-blue-50 disabled:opacity-40"
                      >
                        追加
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      ※ シフトが未保存の場合は先にシフトを保存してください
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
