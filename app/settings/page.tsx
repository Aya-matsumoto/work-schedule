"use client";

import { useEffect, useState, useRef } from "react";
import { STAFF_TYPE_LABELS, toInputDate } from "@/lib/utils";

interface Project { id: number; name: string; client: string | null; fiscalYear: string | null; deadline: string | null; note: string | null; }
interface Staff { id: number; name: string; type: string; color: string; }
interface ProcessType { id: number; name: string; order: number; color: string; }

type Tab = "projects" | "csv" | "staff" | "process-types";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [projectForm, setProjectForm] = useState({ name: "", client: "", fiscalYear: "", deadline: "", note: "" });
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [staffForm, setStaffForm] = useState({ name: "", type: "EMPLOYEE", color: "#378ADD" });
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [ptForm, setPtForm] = useState({ name: "", color: "#378ADD" });
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvResult, setCsvResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const reload = async () => {
    const [p, s, pt] = await Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/staff").then((r) => r.json()),
      fetch("/api/process-types").then((r) => r.json()),
    ]);
    setProjects(p); setStaff(s); setProcessTypes(pt);
  };

  useEffect(() => { reload(); }, []);

  // 業務
  const saveProject = async () => {
    const url = editingProject ? `/api/projects/${editingProject.id}` : "/api/projects";
    const method = editingProject ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...projectForm, deadline: projectForm.deadline || null }) });
    if (res.ok) { await reload(); setProjectForm({ name: "", client: "", fiscalYear: "", deadline: "", note: "" }); setEditingProject(null); showMsg("success", "保存しました"); }
    else showMsg("error", "保存に失敗しました");
  };
  const deleteProject = async (id: number) => {
    if (!confirm("この業務を削除しますか？（橋梁・工程データもすべて削除されます）")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) { await reload(); showMsg("success", "削除しました"); }
    else showMsg("error", "削除に失敗しました");
  };
  const startEditProject = (p: Project) => {
    setEditingProject(p);
    setProjectForm({ name: p.name, client: p.client ?? "", fiscalYear: p.fiscalYear ?? "", deadline: toInputDate(p.deadline), note: p.note ?? "" });
  };

  // 担当者
  const saveStaff = async () => {
    const url = editingStaff ? `/api/staff/${editingStaff.id}` : "/api/staff";
    const method = editingStaff ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(staffForm) });
    if (res.ok) { await reload(); setStaffForm({ name: "", type: "EMPLOYEE", color: "#378ADD" }); setEditingStaff(null); showMsg("success", "保存しました"); }
  };
  const deleteStaff = async (id: number, name: string) => {
    if (!confirm(`「${name}」を削除しますか？（割り当てられた工程の担当者は空欄になります）`)) return;
    const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
    if (res.ok) { await reload(); showMsg("success", "削除しました"); }
    else showMsg("error", "削除に失敗しました");
  };

  // 工程種別
  const savePt = async () => {
    const res = await fetch("/api/process-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ptForm) });
    if (res.ok) { await reload(); setPtForm({ name: "", color: "#378ADD" }); showMsg("success", "追加しました"); }
  };
  const deletePt = async (id: number, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    const res = await fetch(`/api/process-types/${id}`, { method: "DELETE" });
    if (res.ok) { await reload(); showMsg("success", "削除しました"); }
    else { const d = await res.json(); showMsg("error", d.error ?? "削除に失敗しました"); }
  };
  const movePt = async (pt: ProcessType, dir: "up" | "down") => {
    const sorted = [...processTypes].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x.id === pt.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx];
    await Promise.all([
      fetch(`/api/process-types/${pt.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...pt, order: swap.order }) }),
      fetch(`/api/process-types/${swap.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...swap, order: pt.order }) }),
    ]);
    await reload();
  };

  // CSV
  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      return { projectName: cols[0], client: cols[1], bridgeName: cols[2], serialNo: cols[3], spans: cols[4] };
    }).filter((r) => r.projectName && r.bridgeName);
  };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setCsvPreview(parseCSV(ev.target?.result as string)); setCsvResult(null); };
    reader.readAsText(file, "UTF-8");
  };
  const execImport = async () => {
    const res = await fetch("/api/import/csv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: csvPreview }) });
    const result = await res.json();
    setCsvResult(result);
    if (res.ok) await reload();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "projects", label: "業務管理" },
    { key: "csv", label: "CSVインポート" },
    { key: "staff", label: "担当者管理" },
    { key: "process-types", label: "工程種別管理" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">マスタ管理</h1>
      {message && (
        <div className={`mb-4 px-4 py-3 rounded text-sm ${message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{message.text}</div>
      )}

      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${tab === t.key ? "bg-white border border-b-white border-gray-200 text-blue-600 -mb-px" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 業務管理 */}
      {tab === "projects" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-bold text-gray-700 mb-4">{editingProject ? "業務を編集" : "業務を追加"}</h2>
            <div className="space-y-3">
              {[
                { label: "業務名 *", key: "name", placeholder: "例: 西部地区" },
                { label: "元請け", key: "client", placeholder: "例: 大日本ダイヤコンサルタント" },
                { label: "年度", key: "fiscalYear", placeholder: "例: R7" },
                { label: "備考", key: "note", placeholder: "" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input type="text" value={(projectForm as any)[key]} onChange={(e) => setProjectForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-500 mb-1">最終提出期限</label>
                <input type="date" value={projectForm.deadline} onChange={(e) => setProjectForm((f) => ({ ...f, deadline: e.target.value }))} className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveProject} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 flex-1">{editingProject ? "更新" : "追加"}</button>
                {editingProject && <button onClick={() => { setEditingProject(null); setProjectForm({ name: "", client: "", fiscalYear: "", deadline: "", note: "" }); }} className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50">キャンセル</button>}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">業務名</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">元請け</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">提出期限</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.client ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500">{p.deadline ? new Date(p.deadline).toLocaleDateString("ja-JP") : "-"}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => startEditProject(p)} className="text-blue-500 hover:text-blue-700 text-xs">編集</button>
                      <button onClick={() => deleteProject(p.id)} className="text-red-400 hover:text-red-600 text-xs">削除</button>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-gray-400">業務がありません</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSVインポート */}
      {tab === "csv" && (
        <div className="space-y-5">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-bold text-gray-700 mb-2">CSVファイルをアップロード</h2>
            <p className="text-sm text-gray-500 mb-3">形式：<code className="bg-gray-100 px-1 rounded text-xs">業務名,元請け,橋梁名,整理番号,径間数</code>（1行目はヘッダー）</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="text-sm" />
          </div>
          {csvPreview.length > 0 && !csvResult && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-700">プレビュー（{csvPreview.length}件）</h2>
                <button onClick={execImport} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">インポート実行</button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{["業務名", "元請け", "橋梁名", "整理番号", "径間数"].map((h) => <th key={h} className="text-left px-3 py-2 text-gray-600">{h}</th>)}</tr></thead>
                <tbody>
                  {csvPreview.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-1.5">{row.projectName}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.client}</td>
                      <td className="px-3 py-1.5">{row.bridgeName}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.serialNo}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.spans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {csvResult && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-green-600 font-medium">✅ {csvResult.created}件 登録</p>
              <p className="text-gray-500">スキップ：{csvResult.skipped}件</p>
              {csvResult.errors?.length > 0 && <ul className="mt-2 text-sm text-red-600">{csvResult.errors.map((e: string, i: number) => <li key={i}>・{e}</li>)}</ul>}
              <button onClick={() => { setCsvPreview([]); setCsvResult(null); if (fileRef.current) fileRef.current.value = ""; }} className="mt-3 text-sm text-blue-600 hover:underline">別のCSVをインポート</button>
            </div>
          )}
        </div>
      )}

      {/* 担当者管理 */}
      {tab === "staff" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-bold text-gray-700 mb-4">{editingStaff ? "担当者を編集" : "担当者を追加"}</h2>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">氏名 *</label><input type="text" value={staffForm.name} onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))} className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">区分</label><select value={staffForm.type} onChange={(e) => setStaffForm((f) => ({ ...f, type: e.target.value }))} className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"><option value="EMPLOYEE">社員</option><option value="CONTRACT">契約社員</option><option value="PART_TIME">アルバイト</option></select></div>
              <div><label className="block text-xs text-gray-500 mb-1">表示色</label><input type="color" value={staffForm.color} onChange={(e) => setStaffForm((f) => ({ ...f, color: e.target.value }))} className="h-8 w-16 border border-gray-300 rounded" /></div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveStaff} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 flex-1">{editingStaff ? "更新" : "追加"}</button>
                {editingStaff && <button onClick={() => { setEditingStaff(null); setStaffForm({ name: "", type: "EMPLOYEE", color: "#378ADD" }); }} className="border border-gray-300 px-4 py-2 rounded text-sm">キャンセル</button>}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200"><tr><th className="text-left px-4 py-3 text-gray-600 font-medium">氏名</th><th className="text-left px-4 py-3 text-gray-600 font-medium">区分</th><th className="w-28"></th></tr></thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: s.color }} />{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{STAFF_TYPE_LABELS[s.type] ?? s.type}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => { setEditingStaff(s); setStaffForm({ name: s.name, type: s.type, color: s.color }); }} className="text-blue-500 hover:text-blue-700 text-xs">編集</button>
                      <button onClick={() => deleteStaff(s.id, s.name)} className="text-red-400 hover:text-red-600 text-xs">削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 工程種別管理 */}
      {tab === "process-types" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-bold text-gray-700 mb-4">工程種別を追加</h2>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">工程名 *</label><input type="text" value={ptForm.name} onChange={(e) => setPtForm((f) => ({ ...f, name: e.target.value }))} className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">バッジ色</label><input type="color" value={ptForm.color} onChange={(e) => setPtForm((f) => ({ ...f, color: e.target.value }))} className="h-8 w-16 border border-gray-300 rounded" /></div>
              <button onClick={savePt} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 w-full">追加</button>
            </div>
          </div>
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200"><tr><th className="text-left px-4 py-3 text-gray-600 font-medium w-16">順序</th><th className="text-left px-4 py-3 text-gray-600 font-medium">工程名</th><th className="w-36"></th></tr></thead>
              <tbody>
                {[...processTypes].sort((a, b) => a.order - b.order).map((pt) => (
                  <tr key={pt.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-gray-400">{pt.order}</td>
                    <td className="px-4 py-3"><span className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: pt.color }}>{pt.name}</span></td>
                    <td className="px-4 py-3 flex gap-1">
                      <button onClick={() => movePt(pt, "up")} className="border border-gray-300 rounded px-2 py-1 text-xs hover:bg-gray-50">↑</button>
                      <button onClick={() => movePt(pt, "down")} className="border border-gray-300 rounded px-2 py-1 text-xs hover:bg-gray-50">↓</button>
                      <button onClick={() => deletePt(pt.id, pt.name)} className="text-red-400 hover:text-red-600 text-xs ml-1">削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
