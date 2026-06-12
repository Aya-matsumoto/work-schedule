"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import MultiStaffSelect from "@/components/MultiStaffSelect";
import { toInputDate } from "@/lib/utils";

interface Staff { id: number; name: string; }
interface ProcessType { id: number; name: string; order: number; color: string; allowMultipleStaff: boolean; allowAddIteration: boolean; }
interface ProcessRecord {
  id: number | null;
  processTypeId: number;
  processType: ProcessType;
  staffId: number | null;
  staffIds: number[];
  staffMembers?: { staffId: number; staff: { id: number; name: string } }[];
  status: string;
  startDate: string | null;
  endDate: string | null;
  completedDate: string | null;
  note: string | null;
  iteration: number;
  isDirty?: boolean;
}
interface Bridge {
  id: number; name: string; serialNo: string | null; spans: number | null;
  inspectionDate: string | null; inspectionNote: string | null;
  project: { id: number; name: string };
  processes: ProcessRecord[];
}

export default function BridgeDetailPage() {
  const params = useParams();
  const [bridge, setBridge] = useState<Bridge | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formProcesses, setFormProcesses] = useState<ProcessRecord[]>([]);
  const [bridgeForm, setBridgeForm] = useState({
    name: "", serialNo: "", spans: "", inspectionDate: "", inspectionNote: "",
  });

  const loadBridgeData = useCallback((typesData?: ProcessType[]) => {
    return Promise.all([
      fetch(`/api/bridges/${params.id}`).then((r) => r.json()),
      fetch("/api/staff").then((r) => r.json()),
      typesData ? Promise.resolve(typesData) : fetch("/api/process-types").then((r) => r.json()),
    ]).then(([bridgeData, staffData, resolvedTypes]) => {
      setBridge(bridgeData);
      setStaff(staffData);
      setProcessTypes(resolvedTypes);
      setBridgeForm({
        name: bridgeData.name, serialNo: bridgeData.serialNo ?? "",
        spans: bridgeData.spans?.toString() ?? "",
        inspectionDate: toInputDate(bridgeData.inspectionDate),
        inspectionNote: bridgeData.inspectionNote ?? "",
      });
      // 工程行を構築
      const existing: ProcessRecord[] = bridgeData.processes ?? [];
      const rows: ProcessRecord[] = [];
      for (const pt of (resolvedTypes as ProcessType[])) {
        const matching = existing.filter((p: ProcessRecord) => p.processTypeId === pt.id);
        if (matching.length === 0) {
          rows.push({ id: null, processTypeId: pt.id, processType: pt, staffId: null, staffIds: [], status: "NOT_STARTED", startDate: null, endDate: null, completedDate: null, note: null, iteration: 1 });
        } else {
          for (const m of matching) {
            const staffIds = m.staffMembers && m.staffMembers.length > 0
              ? m.staffMembers.map((sm: { staffId: number }) => sm.staffId)
              : m.staffId ? [m.staffId] : [];
            rows.push({ ...m, staffIds, isDirty: false });
          }
        }
      }
      setFormProcesses(rows);
      setLoading(false);
    });
  }, [params.id]);

  useEffect(() => { loadBridgeData(); }, [loadBridgeData]);

  const handleProcessChange = useCallback((index: number, field: string, value: string | null) => {
    setFormProcesses((prev) => {
      const next = [...prev];
      const row: any = { ...next[index], [field]: value, isDirty: true };
      if (field === "completedDate") row.status = value ? "COMPLETED" : (row.startDate ? "IN_PROGRESS" : "NOT_STARTED");
      if (field === "startDate" && value && row.status === "NOT_STARTED") row.status = "IN_PROGRESS";
      next[index] = row;
      return next;
    });
    setIsDirty(true);
  }, []);

  const addRevisionRow = useCallback((processTypeId: number, processType: ProcessType) => {
    setFormProcesses((prev) => {
      const sameType = prev.filter((p) => p.processTypeId === processTypeId);
      const nextIteration = sameType.length + 1;
      const insertIdx = prev.map((p, i) => p.processTypeId === processTypeId ? i : -1).filter(i => i >= 0).at(-1) ?? prev.length - 1;
      const next = [...prev];
      next.splice(insertIdx + 1, 0, { id: null, processTypeId, processType, staffId: null, staffIds: [], status: "NOT_STARTED", startDate: null, endDate: null, completedDate: null, note: null, iteration: nextIteration, isDirty: true });
      return next;
    });
    setIsDirty(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await fetch(`/api/bridges/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bridgeForm, spans: bridgeForm.spans ? parseInt(bridgeForm.spans) : null }),
      });
      for (const row of formProcesses) {
        if (!row.isDirty && row.id !== null) continue;
        const payload = { processTypeId: row.processTypeId, staffIds: row.staffIds, status: row.status, startDate: row.startDate || null, endDate: row.endDate || null, completedDate: row.completedDate || null, note: row.note || null, iteration: row.iteration };
        if (row.id === null) {
          if (row.staffIds.length > 0 || row.startDate || row.endDate || row.completedDate || row.note) {
            await fetch(`/api/bridges/${params.id}/processes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          }
        } else {
          await fetch(`/api/processes/${row.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        }
      }
      await loadBridgeData(processTypes);
      setIsDirty(false);
      setMessage({ type: "success", text: "保存しました" });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "error", text: "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-8 text-center text-gray-400">読み込み中...</div>;
  if (!bridge) return <div className="py-8 text-center text-red-500">橋梁が見つかりません</div>;

  return (
    <div className="d3-body">
      <div className="d3-headrow">
        <div>
          <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--muted)" }}>
            <Link href="/" className="hover:underline">ダッシュボード</Link>
            <span>›</span>
            <Link href={`/projects/${bridge.project.id}`} className="hover:underline">{bridge.project.name}</Link>
            <span>›</span>
            <span>{bridge.name}</span>
          </div>
          <h1 className="d3-h1"><span className="em">{bridge.name}</span></h1>
          <div className="d3-hsub">{bridge.project.name}</div>
        </div>
      </div>

      {/* 橋梁基本情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-5">
        <h2 className="font-semibold mb-4" style={{ color: "var(--ink)", fontSize: 14 }}>橋梁基本情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "橋梁名 *", key: "name", type: "text" },
            { label: "整理番号", key: "serialNo", type: "text" },
            { label: "径間数", key: "spans", type: "number" },
            { label: "点検完了日", key: "inspectionDate", type: "date" },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>{label}</label>
              <input
                type={type}
                value={(bridgeForm as any)[key]}
                onChange={(e) => { setBridgeForm((f) => ({ ...f, [key]: e.target.value })); setIsDirty(true); }}
                className="d3-input w-full"
              />
            </div>
          ))}
          <div className="col-span-2 md:col-span-4">
            <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>点検メモ</label>
            <input type="text" value={bridgeForm.inspectionNote}
              onChange={(e) => { setBridgeForm((f) => ({ ...f, inspectionNote: e.target.value })); setIsDirty(true); }}
              className="d3-input w-full" />
          </div>
        </div>
      </div>

      {/* 工程一覧 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold" style={{ color: "var(--ink)", fontSize: 14 }}>工程スケジュール</h2>
        </div>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--surface)" }} className="border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2 font-medium w-28" style={{ color: "var(--muted)", fontSize: 12 }}>工程</th>
              <th className="text-left px-4 py-2 font-medium w-24" style={{ color: "var(--muted)", fontSize: 12 }}>担当者</th>
              <th className="text-left px-4 py-2 font-medium w-30" style={{ color: "var(--muted)", fontSize: 12 }}>着手予定日</th>
              <th className="text-left px-4 py-2 font-medium w-30" style={{ color: "var(--muted)", fontSize: 12 }}>完了予定日</th>
              <th className="text-left px-4 py-2 font-medium w-30" style={{ color: "var(--muted)", fontSize: 12 }}>完了日</th>
              <th className="text-left px-4 py-2 font-medium w-20" style={{ color: "var(--muted)", fontSize: 12 }}>状態</th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--muted)", fontSize: 12 }}>備考</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {formProcesses.map((row, idx) => (
              <tr key={`${row.processTypeId}-${row.iteration}-${idx}`} className="border-b border-gray-100">
                <td className="px-4 py-2">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: row.processType.color }}>
                    {row.processType.name}{row.iteration > 1 ? `②` : ""}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <MultiStaffSelect
                    staff={staff}
                    selectedIds={row.staffIds}
                    singleOnly={!row.processType.allowMultipleStaff}
                    onChange={(ids) => {
                      setFormProcesses((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], staffIds: ids, staffId: ids[0] ?? null, isDirty: true };
                        return next;
                      });
                      setIsDirty(true);
                    }}
                  />
                </td>
                <td className="px-4 py-2">
                  <input type="date" value={row.startDate ? toInputDate(row.startDate) : ""} onChange={(e) => handleProcessChange(idx, "startDate", e.target.value || null)} className="border border-gray-300 rounded px-2 py-1 text-sm w-full" />
                </td>
                <td className="px-4 py-2">
                  <input type="date" value={row.endDate ? toInputDate(row.endDate) : ""} onChange={(e) => handleProcessChange(idx, "endDate", e.target.value || null)} className="border border-gray-300 rounded px-2 py-1 text-sm w-full" />
                </td>
                <td className="px-4 py-2">
                  <input type="date" value={row.completedDate ? toInputDate(row.completedDate) : ""} onChange={(e) => handleProcessChange(idx, "completedDate", e.target.value || null)} className="border border-gray-300 rounded px-2 py-1 text-sm w-full" />
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={row.status} endDate={row.endDate} completedDate={row.completedDate} />
                </td>
                <td className="px-4 py-2">
                  <input type="text" value={row.note ?? ""} onChange={(e) => handleProcessChange(idx, "note", e.target.value || null)} placeholder="備考" className="border border-gray-300 rounded px-2 py-1 text-sm w-full" />
                </td>
                <td className="px-4 py-2">
                  {row.processType.allowAddIteration && (
                    <button onClick={() => addRevisionRow(row.processTypeId, row.processType)} className="text-blue-500 hover:text-blue-700 text-xs" title="追加">＋</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 保存ボタン */}
      <div className="flex items-center gap-4">
        {isDirty && <span className="text-sm" style={{ color: "#B45309" }}>⚠ 未保存の変更があります</span>}
        {message && <span className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>{message.text}</span>}
        <button onClick={handleSave} disabled={saving || !isDirty} className="d3-primary ml-auto">
          {saving ? "保存中..." : "一括保存"}
        </button>
      </div>
    </div>
  );
}
