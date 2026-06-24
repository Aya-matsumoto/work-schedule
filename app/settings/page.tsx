"use client";

import { useEffect, useState, useRef } from "react";
import { STAFF_TYPE_LABELS, toInputDate } from "@/lib/utils";

interface Project { id: number; name: string; client: string | null; fiscalYear: string | null; deadline: string | null; note: string | null; displayOrder: number; }
interface Staff { id: number; name: string; type: string; color: string; }
interface ProcessType { id: number; name: string; order: number; color: string; allowMultipleStaff: boolean; allowAddIteration: boolean; }
interface Holiday { id: number; date: string; name: string; }

type Tab = "projects" | "csv" | "staff" | "process-types" | "holidays";

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
  const [ptForm, setPtForm] = useState({ name: "", color: "#378ADD", allowMultipleStaff: false, allowAddIteration: false });
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvResult, setCsvResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // 工程CSV import 用
  const [processCsvPreview, setProcessCsvPreview] = useState<any[]>([]);
  const [processCsvResult, setProcessCsvResult] = useState<any>(null);
  const [processImporting, setProcessImporting] = useState(false);
  const processCsvRef = useRef<HTMLInputElement>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "" });

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const reload = async () => {
    const [p, s, pt, hol] = await Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/staff").then((r) => r.json()),
      fetch("/api/process-types").then((r) => r.json()),
      fetch("/api/holidays").then((r) => r.json()),
    ]);
    setProjects(p); setStaff(s); setProcessTypes(pt);
    setHolidays(Array.isArray(hol) ? hol : []);
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
  // 業務の表示順を変更（↑/↓ボタン用）
  const moveProject = async (p: Project, dir: "up" | "down") => {
    // displayOrder昇順 → 同値はid降順（登録が新しい順）でソート
    const sorted = [...projects].sort((a, b) =>
      a.displayOrder !== b.displayOrder ? a.displayOrder - b.displayOrder : b.id - a.id
    );
    const idx = sorted.findIndex((x) => x.id === p.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    // 隣と位置を入れ替えた新しい並び順を作成し、全件のdisplayOrderを連番で振り直す
    const newSorted = [...sorted];
    [newSorted[idx], newSorted[swapIdx]] = [newSorted[swapIdx], newSorted[idx]];

    await fetch("/api/projects/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orders: newSorted.map((proj, i) => ({ id: proj.id, displayOrder: i })),
      }),
    });
    await reload();
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
    if (res.ok) { await reload(); setPtForm({ name: "", color: "#378ADD", allowMultipleStaff: false, allowAddIteration: false }); showMsg("success", "追加しました"); }
  };
  const updatePtFlags = async (pt: ProcessType, field: "allowMultipleStaff" | "allowAddIteration", value: boolean) => {
    await fetch(`/api/process-types/${pt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pt.name, order: pt.order, color: pt.color, [field]: value }),
    });
    await reload();
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

  // CSV ダウンロード
  const downloadCSV = async (project: Project) => {
    const [projectRes, cfgRes, ptsRes] = await Promise.all([
      fetch(`/api/projects/${project.id}`).then((r) => r.json()),
      fetch("/api/bridge-process-configs").then((r) => r.json()),
      fetch("/api/process-types").then((r) => r.json()),
    ]);
    const bridges: any[] = projectRes.bridges ?? [];
    const cfgs: any[] = Array.isArray(cfgRes) ? cfgRes : [];
    const targetPtNames = ["調書作成", "チェック", "修正"];
    const pts: any[] = Array.isArray(ptsRes)
      ? ptsRes.filter((pt: any) => targetPtNames.includes(pt.name)).sort((a: any, b: any) => a.order - b.order)
      : [];

    // bridgeId→ptId→config のマップ
    const cfgMap = new Map<string, any>();
    for (const c of cfgs) cfgMap.set(`${c.bridgeId}-${c.processTypeId}`, c);

    const ptCols = pts.map((pt: any) => `${pt.name}_径間係数,${pt.name}_必要時間`).join(",");
    const header = `業務名,元請け,橋梁名,整理番号,径間数,${ptCols || ""},点検完了日`.replace(/,+/g, ",").replace(/,$/, "");

    const rows = bridges.map((b) => {
      const inspectionDate = b.inspectionDate
        ? new Date(b.inspectionDate).toISOString().slice(0, 10)
        : "";
      const ptCells = pts.flatMap((pt: any) => {
        const cfg = cfgMap.get(`${b.id}-${pt.id}`);
        // 径間係数: 工程別設定がなければ 調書作成 の場合 Bridge.spanCoefficient をフォールバック
        const coef = cfg?.spanCoefficient != null
          ? String(cfg.spanCoefficient)
          : pt.name === "調書作成" ? String(b.spanCoefficient ?? "") : "";
        return [
          coef,
          cfg?.requiredHours != null ? String(cfg.requiredHours) : "",
        ];
      });
      return [
        project.name,
        project.client ?? "",
        b.name,
        b.serialNo ?? "",
        b.spans ?? "",
        ...ptCells,
        inspectionDate,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csv = [header, ...rows].join("\r\n");
    const bom = "﻿"; // Excel用BOM
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 工程進捗 CSV ダウンロード
  const downloadProcessCSV = async (project: Project) => {
    const [projectRes, ptsRes] = await Promise.all([
      fetch(`/api/projects/${project.id}`).then((r) => r.json()),
      fetch("/api/process-types").then((r) => r.json()),
    ]);
    const bridges: any[] = projectRes.bridges ?? [];
    const targetPtNames = ["調書作成", "チェック", "修正"];
    const pts: any[] = Array.isArray(ptsRes)
      ? ptsRes.filter((pt: any) => targetPtNames.includes(pt.name)).sort((a: any, b: any) => a.order - b.order)
      : [];

    const statusLabel = (s: string) =>
      s === "COMPLETED" || s === "DONE" ? "完了" : s === "IN_PROGRESS" ? "作業中" : "未着手";

    const formatD = (d: string | null | undefined) =>
      d ? new Date(d).toISOString().slice(0, 10) : "";

    // 反復番号 → 丸数字（1→"", 2→"②", 3→"③"…）
    const iterMark = (n: number) => (n <= 1 ? "" : String.fromCharCode(0x2460 + n - 1));

    // 工程種別ごとの最大反復数を算出（複数入力に対応）
    const maxIter = new Map<number, number>();
    for (const b of bridges) {
      for (const pt of pts) {
        const cnt = (b.processes ?? []).filter((p: any) => p.processType?.id === pt.id).length;
        if (cnt > (maxIter.get(pt.id) ?? 0)) maxIter.set(pt.id, cnt);
      }
    }

    const ptCols = pts.flatMap((pt: any) => {
      const mi = Math.max(1, maxIter.get(pt.id) ?? 1);
      const cols: string[] = [];
      for (let it = 1; it <= mi; it++) {
        const sfx = iterMark(it);
        cols.push(`${pt.name}${sfx}_担当者`, `${pt.name}${sfx}_開始日`, `${pt.name}${sfx}_終了日`, `${pt.name}${sfx}_ステータス`);
      }
      return cols;
    });
    const header = ["業務名", "元請け", "橋梁名", "整理番号", ...ptCols].join(",");

    // 同工程内を着手予定日の昇順で並べ替え（未入力は末尾）。詳細画面の表示順と一致させる
    const sortByStart = (a: any, b: any) => {
      if (!a.startDate && !b.startDate) return (a.iteration ?? 1) - (b.iteration ?? 1);
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    };

    const rows = bridges.map((b) => {
      const cells = pts.flatMap((pt: any) => {
        const mi = Math.max(1, maxIter.get(pt.id) ?? 1);
        const procs: any[] = (b.processes ?? [])
          .filter((p: any) => p.processType?.id === pt.id)
          .sort(sortByStart);
        const out: string[] = [];
        for (let it = 1; it <= mi; it++) {
          // iteration 値に依存せず、日付順の位置で列に割り当てる
          const proc = procs[it - 1] ?? null;
          if (!proc) { out.push("", "", "", ""); continue; }
          const staffNames = proc.staffMembers && proc.staffMembers.length > 0
            ? proc.staffMembers.map((sm: any) => sm.staff.name).join("・")
            : proc.staff?.name ?? "";
          out.push(
            staffNames,
            formatD(proc.startDate),
            formatD(proc.endDate),
            statusLabel(proc.status ?? "NOT_STARTED"),
          );
        }
        return out;
      });
      return [project.name, project.client ?? "", b.name, b.serialNo ?? "", ...cells]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csv = [header, ...rows].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}_工程進捗.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV インポート
  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    // ヘッダー行から列インデックスを動的に取得
    const headerCols = lines[0].split(",").map((c) => c.replace(/"/g, "").trim());
    const idx = (name: string) => headerCols.indexOf(name);
    // 工程別の動的列（*_径間係数 / *_必要時間）を抽出
    const dynamicCols = headerCols.filter((h) => h.endsWith("_径間係数") || h.endsWith("_必要時間"));

    return lines.slice(1).map((line) => {
      // ダブルクォート対応の分割
      const cols: string[] = [];
      let cur = "", inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      cols.push(cur.trim());
      const get = (i: number) => (i >= 0 ? (cols[i] ?? "").replace(/"/g, "").trim() : "");

      const row: Record<string, string> = {
        projectName:     get(idx("業務名")),
        client:          get(idx("元請け")),
        bridgeName:      get(idx("橋梁名")),
        serialNo:        get(idx("整理番号")),
        spans:           get(idx("径間数")),
        spanCoefficient: get(idx("径間係数")), // 旧フォーマット後方互換
        inspectionDate:  get(idx("点検完了日")),
      };
      // 工程別動的列をすべて追加
      for (const col of dynamicCols) {
        row[col] = get(idx(col));
      }
      return row;
    }).filter((r) => r.projectName && r.bridgeName);
  };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // まずUTF-8で試みる。文字化けしていればShift-JISで再読み込み
    const tryRead = (encoding: string) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (encoding === "UTF-8" && text.includes("�")) {
          // 文字化け検出 → Shift-JISで再試行
          tryRead("Shift-JIS");
          return;
        }
        setCsvPreview(parseCSV(text));
        setCsvResult(null);
      };
      reader.readAsText(file, encoding);
    };
    tryRead("UTF-8");
  };
  const execImport = async () => {
    setImporting(true);
    setCsvResult(null);
    try {
      const res = await fetch("/api/import/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: csvPreview }),
      });
      const result = await res.json();
      const finalResult = { ...result, ok: res.ok };
      setCsvResult(finalResult);
      if (res.ok) {
        const parts = [];
        if ((result.created ?? 0) > 0) parts.push(`新規登録 ${result.created}件`);
        if ((result.updated ?? 0) > 0) parts.push(`更新 ${result.updated}件`);
        if ((result.skipped ?? 0) > 0) parts.push(`スキップ ${result.skipped}件`);
        showMsg("success", `✅ インポート完了：${parts.join("、") || "対象なし"}`);
        await reload();
      } else {
        showMsg("error", "❌ インポートに失敗しました");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      showMsg("error", "❌ 通信エラーが発生しました。再度お試しください。");
      setCsvResult({ ok: false });
    } finally {
      setImporting(false);
    }
  };

  // 工程CSV パース
  const parseProcessCSV = (text: string) => {
    const lines = text.trim().split("\n");
    const headerCols = lines[0].split(",").map((c) => c.replace(/"/g, "").trim());
    const idx = (name: string) => headerCols.indexOf(name);
    // 工程別動的列（*_担当者 / *_開始日 / *_終了日 / *_ステータス）
    const dynamicCols = headerCols.filter((h) =>
      h.endsWith("_担当者") || h.endsWith("_開始日") || h.endsWith("_終了日") || h.endsWith("_ステータス")
    );
    return lines.slice(1).map((line) => {
      const cols: string[] = [];
      let cur = "", inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      cols.push(cur.trim());
      const get = (i: number) => (i >= 0 ? (cols[i] ?? "").replace(/"/g, "").trim() : "");
      const row: Record<string, string> = {
        projectName: get(idx("業務名")),
        bridgeName:  get(idx("橋梁名")),
        serialNo:    get(idx("整理番号")),
      };
      for (const col of dynamicCols) row[col] = get(idx(col));
      return row;
    }).filter((r) => r.projectName && r.bridgeName);
  };

  const handleProcessCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const tryRead = (encoding: string) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (encoding === "UTF-8" && text.includes("＝")) {
          tryRead("Shift-JIS"); return;
        }
        setProcessCsvPreview(parseProcessCSV(text));
        setProcessCsvResult(null);
      };
      reader.readAsText(file, encoding);
    };
    tryRead("UTF-8");
  };

  const execProcessImport = async () => {
    setProcessImporting(true);
    setProcessCsvResult(null);
    try {
      const res = await fetch("/api/import/process-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: processCsvPreview }),
      });
      const result = await res.json();
      setProcessCsvResult({ ...result, ok: res.ok });
      if (res.ok) {
        const parts = [];
        if ((result.created ?? 0) > 0) parts.push(`新規登録 ${result.created}件`);
        if ((result.updated ?? 0) > 0) parts.push(`更新 ${result.updated}件`);
        if ((result.skipped ?? 0) > 0) parts.push(`スキップ ${result.skipped}件`);
        showMsg("success", `✅ インポート完了：${parts.join("、") || "対象なし"}`);
      } else {
        showMsg("error", "❌ インポートに失敗しました");
      }
    } catch {
      showMsg("error", "❌ 通信エラーが発生しました");
      setProcessCsvResult({ ok: false });
    } finally {
      setProcessImporting(false);
    }
  };

  // 休日
  const addHoliday = async () => {
    if (!holidayForm.date) { showMsg("error", "日付を入力してください"); return; }
    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(holidayForm),
    });
    if (res.ok) {
      await reload();
      setHolidayForm({ date: "", name: "" });
      showMsg("success", "追加しました");
    } else {
      showMsg("error", "追加に失敗しました");
    }
  };
  const deleteHoliday = async (id: number) => {
    if (!confirm("この休日を削除しますか？")) return;
    const res = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    if (res.ok) { await reload(); showMsg("success", "削除しました"); }
    else showMsg("error", "削除に失敗しました");
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "projects", label: "業務管理" },
    { key: "csv", label: "CSVインポート" },
    { key: "staff", label: "担当者管理" },
    { key: "process-types", label: "工程種別管理" },
    { key: "holidays", label: "休日設定" },
  ];

  return (
    <div className="d3-body">
      <div className="d3-headrow">
        <div>
          <h1 className="d3-h1">マスタ<span className="em">管理</span></h1>
          <div className="d3-hsub">業務・担当者・工程の基本情報を管理します</div>
        </div>
      </div>
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-700 ${message.type === "success" ? "d3-msg-ok" : "d3-msg-err"}`} style={{ background: message.type === "success" ? "#E3F6EE" : "#FEE2E2", padding: "12px 16px", borderRadius: 12, marginBottom: 16 }}>{message.text}</div>
      )}

      <div className="d3-tabs">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`d3-tab${tab === t.key ? " on" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 業務管理 */}
      {tab === "projects" && (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, alignItems: "start" }}>
          <div className="d3-panel">
            <h2 style={{ fontWeight: 800, fontSize: 16, marginBottom: 16, color: "var(--ink)" }}>{editingProject ? "業務を編集" : "業務を追加"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "業務名 *", key: "name", placeholder: "例: 西部地区" },
                { label: "元請け", key: "client", placeholder: "例: 大日本ダイヤコンサルタント" },
                { label: "年度", key: "fiscalYear", placeholder: "例: R7" },
                { label: "備考", key: "note", placeholder: "" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#5A6080", marginBottom: 6 }}>{label}</label>
                  <input type="text" value={(projectForm as any)[key]} onChange={(e) => setProjectForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className="d3-input" />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#5A6080", marginBottom: 6 }}>最終提出期限</label>
                <input type="date" value={projectForm.deadline} onChange={(e) => setProjectForm((f) => ({ ...f, deadline: e.target.value }))} className="d3-input" />
              </div>
              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                <button onClick={saveProject} className="d3-primary" style={{ flex: 1, justifyContent: "center" }}>{editingProject ? "更新" : "追加"}</button>
                {editingProject && <button onClick={() => { setEditingProject(null); setProjectForm({ name: "", client: "", fiscalYear: "", deadline: "", note: "" }); }} className="d3-ghost">キャンセル</button>}
              </div>
            </div>
          </div>
          <div className="d3-card">
            <table className="d3-table">
              <thead>
                <tr>
                  <th style={{ width: 64, textAlign: "center" }}>順番</th>
                  <th>業務名</th>
                  <th>元請け</th>
                  <th>提出期限</th>
                  <th style={{ width: 112 }}></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p, idx) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="px-2 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => moveProject(p, "up")}
                          disabled={idx === 0}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-xs px-1"
                          title="上に移動"
                        >▲</button>
                        <button
                          onClick={() => moveProject(p, "down")}
                          disabled={idx === projects.length - 1}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-xs px-1"
                          title="下に移動"
                        >▼</button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.client ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500">{p.deadline ? new Date(p.deadline).toLocaleDateString("ja-JP") : "-"}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => startEditProject(p)} className="text-blue-500 hover:text-blue-700 text-xs">編集</button>
                      <button onClick={() => deleteProject(p.id)} className="text-red-400 hover:text-red-600 text-xs">削除</button>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-gray-400">業務がありません</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSVインポート */}
      {tab === "csv" && (
        <div className="space-y-5">

          {/* 橋梁マスタ CSVダウンロード */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-bold text-gray-700 mb-1">橋梁マスタ CSVダウンロード</h2>
            <p className="text-xs text-gray-400 mb-4">業務ごとに登録済みの橋梁データ（径間数・係数・必要時間・点検完了日）をCSVでダウンロードできます。</p>
            {projects.length === 0 ? (
              <p className="text-sm text-gray-400">業務が登録されていません</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => downloadCSV(p)}
                    className="flex items-center gap-1.5 border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 工程進捗 CSVダウンロード */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-bold text-gray-700 mb-1">工程進捗 CSVダウンロード</h2>
            <p className="text-xs text-gray-400 mb-1">業務ごとに現在の工程状況（担当者・開始日・終了日・ステータス）をCSVでダウンロードできます。</p>
            <p className="text-xs text-gray-400 mb-4">
              形式：<code className="bg-gray-100 px-1 rounded text-xs">業務名, 元請け, 橋梁名, 整理番号, 調書作成_担当者, 調書作成_開始日, 調書作成_終了日, 調書作成_ステータス, …</code>
            </p>
            {projects.length === 0 ? (
              <p className="text-sm text-gray-400">業務が登録されていません</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => downloadProcessCSV(p)}
                    className="flex items-center gap-1.5 border border-indigo-300 rounded px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-bold text-gray-700 mb-2">CSVファイルをアップロード</h2>
            <p className="text-sm text-gray-500 mb-1">形式：<code className="bg-gray-100 px-1 rounded text-xs">業務名,元請け,橋梁名,整理番号,径間数,調書作成_径間係数,調書作成_必要時間,...</code>（1行目はヘッダー）</p>
            <p className="text-xs text-gray-400 mb-3">※ 径間係数・必要時間は工程別列で設定。点検完了日は YYYY-MM-DD または YYYY/MM/DD 形式。既に登録済みの橋梁は上書き更新されます。</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="text-sm" />
          </div>
          {csvPreview.length > 0 && !csvResult && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-700">プレビュー（{csvPreview.length}件）</h2>
                <button
                  onClick={execImport}
                  disabled={importing}
                  className={`px-5 py-2 rounded text-sm font-medium text-white transition-colors ${importing ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      インポート中...
                    </span>
                  ) : "インポート実行"}
                </button>
              </div>
              {importing && (
                <div className="mb-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                  ⏳ データを登録しています。しばらくお待ちください...
                </div>
              )}
              {(() => {
                // プレビューデータから動的に列名を取得
                const allKeys = csvPreview.length > 0 ? Object.keys(csvPreview[0]) : [];
                // 工程別の径間係数・必要時間列を動的に取得（順序を保持）
                const ptKeys = allKeys.filter((k) => k.endsWith("_径間係数") || k.endsWith("_必要時間"));
                return (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr>
                    {["業務名", "元請け", "橋梁名", "整理番号", "径間数", ...ptKeys, "点検完了日"].map((h) => <th key={h} className="text-left px-3 py-2 text-gray-600">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {csvPreview.slice(0, 20).map((row: any, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5">{row.projectName}</td>
                        <td className="px-3 py-1.5 text-gray-500">{row.client}</td>
                        <td className="px-3 py-1.5">{row.bridgeName}</td>
                        <td className="px-3 py-1.5 text-gray-500">{row.serialNo}</td>
                        <td className="px-3 py-1.5 text-gray-500">{row.spans}</td>
                        {ptKeys.map((k) => (
                          <td key={k} className="px-3 py-1.5 text-gray-500">{row[k] || "-"}</td>
                        ))}
                        <td className="px-3 py-1.5 text-gray-500">{row.inspectionDate || "-"}</td>
                      </tr>
                    ))}
                    {csvPreview.length > 20 && (
                      <tr><td colSpan={6 + ptKeys.length} className="px-3 py-2 text-xs text-gray-400 text-center">他 {csvPreview.length - 20} 件（プレビューは20件まで表示）</td></tr>
                    )}
                  </tbody>
                </table>
                );
              })()}
            </div>
          )}
          {csvResult && (
            <div className={`bg-white rounded-lg border p-5 ${csvResult.ok ? "border-green-300" : "border-red-300"}`}>
              {csvResult.ok ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">✅</span>
                    <p className="text-green-700 font-bold text-lg">インポート完了しました</p>
                  </div>
                  <div className="bg-green-50 rounded p-3 text-sm space-y-1">
                    <p className="text-green-800">✔ 新規登録：<strong>{csvResult.created}件</strong></p>
                    {csvResult.updated > 0 && (
                      <p className="text-blue-700">✔ 上書き更新：<strong>{csvResult.updated}件</strong></p>
                    )}
                    {csvResult.skipped > 0 && (
                      <p className="text-gray-500">スキップ：{csvResult.skipped}件</p>
                    )}
                  </div>
                  {csvResult.dateParseErrors?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-orange-600 mb-1">⚠ 日付の解析に失敗した行（スキップされました）：</p>
                      <ul className="text-sm text-orange-600 space-y-1">
                        {csvResult.dateParseErrors.map((e: string, i: number) => <li key={i}>・{e}</li>)}
                      </ul>
                    </div>
                  )}
                  {csvResult.errors?.length > 0 && (
                    <ul className="mt-3 text-sm text-red-600 space-y-1">
                      {csvResult.errors.map((e: string, i: number) => <li key={i}>・{e}</li>)}
                    </ul>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">❌</span>
                  <p className="text-red-700 font-bold">インポートに失敗しました</p>
                </div>
              )}
              {csvResult.error && <p className="mt-2 text-sm text-red-600">{csvResult.error}</p>}
              <button
                onClick={() => { setCsvPreview([]); setCsvResult(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
              >
                別のCSVをインポート
              </button>
            </div>
          )}

          {/* ─── 工程進捗 CSVインポート ─── */}
          <div className="bg-white rounded-lg border border-indigo-200 p-5">
            <h2 className="font-bold text-gray-700 mb-1">工程進捗 CSVアップロード</h2>
            <p className="text-sm text-gray-500 mb-1">
              形式：<code className="bg-gray-100 px-1 rounded text-xs">業務名,元請け,橋梁名,整理番号,調書作成_担当者,調書作成_開始日,調書作成_終了日,調書作成_ステータス,…</code>
            </p>
            <p className="text-xs text-gray-400 mb-3">
              ※ ステータスは「未着手」「作業中」「完了」で入力。担当者が複数の場合は「・」区切り。業務・橋梁が未登録の行はスキップされます。
            </p>
            <input ref={processCsvRef} type="file" accept=".csv" onChange={handleProcessCsvFile} className="text-sm" />
          </div>

          {processCsvPreview.length > 0 && !processCsvResult && (() => {
            const allKeys = Object.keys(processCsvPreview[0]);
            const ptKeys = allKeys.filter((k) =>
              k.endsWith("_担当者") || k.endsWith("_開始日") || k.endsWith("_終了日") || k.endsWith("_ステータス")
            );
            return (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-700">工程進捗プレビュー（{processCsvPreview.length}件）</h2>
                  <button
                    onClick={execProcessImport}
                    disabled={processImporting}
                    className={`px-5 py-2 rounded text-sm font-medium text-white transition-colors ${processImporting ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"}`}
                  >
                    {processImporting ? "インポート中..." : "インポート実行"}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead className="bg-gray-50">
                      <tr>
                        {["業務名", "橋梁名", "整理番号", ...ptKeys].map((h) => (
                          <th key={h} className="text-left px-3 py-2 text-gray-600 text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {processCsvPreview.slice(0, 20).map((row: any, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-3 py-1.5">{row.projectName}</td>
                          <td className="px-3 py-1.5">{row.bridgeName}</td>
                          <td className="px-3 py-1.5 text-gray-500">{row.serialNo || "-"}</td>
                          {ptKeys.map((k) => (
                            <td key={k} className={`px-3 py-1.5 text-xs ${k.endsWith("_ステータス") ? "font-medium text-indigo-700" : "text-gray-500"}`}>
                              {row[k] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {processCsvPreview.length > 20 && (
                        <tr>
                          <td colSpan={3 + ptKeys.length} className="px-3 py-2 text-xs text-gray-400 text-center">
                            他 {processCsvPreview.length - 20} 件（プレビューは20件まで表示）
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {processCsvResult && (
            <div className={`bg-white rounded-lg border p-5 ${processCsvResult.ok ? "border-green-300" : "border-red-300"}`}>
              {processCsvResult.ok ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">✅</span>
                    <p className="text-green-700 font-bold text-lg">工程進捗インポート完了</p>
                  </div>
                  <div className="bg-green-50 rounded p-3 text-sm space-y-1">
                    {(processCsvResult.created ?? 0) > 0 && <p className="text-green-800">✔ 新規登録：<strong>{processCsvResult.created}件</strong></p>}
                    {(processCsvResult.updated ?? 0) > 0 && <p className="text-blue-700">✔ 更新：<strong>{processCsvResult.updated}件</strong></p>}
                    {(processCsvResult.skipped ?? 0) > 0 && <p className="text-gray-500">スキップ：{processCsvResult.skipped}件</p>}
                  </div>
                  {processCsvResult.errors?.length > 0 && (
                    <ul className="mt-3 text-sm text-orange-600 space-y-1">
                      {processCsvResult.errors.map((e: string, i: number) => <li key={i}>・{e}</li>)}
                    </ul>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">❌</span>
                  <p className="text-red-700 font-bold">インポートに失敗しました</p>
                </div>
              )}
              {processCsvResult.error && <p className="mt-2 text-sm text-red-600">{processCsvResult.error}</p>}
              <button
                onClick={() => { setProcessCsvPreview([]); setProcessCsvResult(null); if (processCsvRef.current) processCsvRef.current.value = ""; }}
                className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
              >
                別のCSVをインポート
              </button>
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
              <div className="flex flex-col gap-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={ptForm.allowMultipleStaff} onChange={(e) => setPtForm((f) => ({ ...f, allowMultipleStaff: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                  担当者を複数設定可
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={ptForm.allowAddIteration} onChange={(e) => setPtForm((f) => ({ ...f, allowAddIteration: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                  ＋で繰り返し追加可
                </label>
              </div>
              <button onClick={savePt} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 w-full">追加</button>
            </div>
          </div>
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium w-12">順序</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">工程名</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium w-28">複数担当</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium w-28">繰り返し追加</th>
                  <th className="w-28"></th>
                </tr>
              </thead>
              <tbody>
                {[...processTypes].sort((a, b) => a.order - b.order).map((pt) => (
                  <tr key={pt.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-gray-400">{pt.order}</td>
                    <td className="px-4 py-3"><span className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: pt.color }}>{pt.name}</span></td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={pt.allowMultipleStaff}
                        onChange={(e) => updatePtFlags(pt, "allowMultipleStaff", e.target.checked)}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={pt.allowAddIteration}
                        onChange={(e) => updatePtFlags(pt, "allowAddIteration", e.target.checked)}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                    </td>
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

      {/* 休日設定 */}
      {tab === "holidays" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 追加フォーム */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-bold text-gray-700 mb-4">公休日を追加</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">日付 *</label>
                <input
                  type="date"
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, date: e.target.value }))}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">名称（任意）</label>
                <input
                  type="text"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="例: 創立記念日、夏季休暇"
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                />
              </div>
              <button
                onClick={addHoliday}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 w-full"
              >
                追加
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-4 leading-relaxed">
              ここで登録した日は工程割り振りの対象外となり、ダッシュボードでは薄赤色でグレーアウト表示されます。
            </p>
          </div>

          {/* 休日一覧 */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">日付</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">曜日</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">名称</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => {
                  const d = new Date(h.date + "T00:00:00");
                  const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <tr key={h.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-medium">{h.date.replace(/-/g, "/")}</td>
                      <td className={`px-4 py-3 ${isWeekend ? "text-red-400" : "text-gray-600"}`}>{dow}曜</td>
                      <td className="px-4 py-3 text-gray-500">{h.name || "-"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteHoliday(h.id)} className="text-red-400 hover:text-red-600 text-xs">削除</button>
                      </td>
                    </tr>
                  );
                })}
                {holidays.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-gray-400">休日が登録されていません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
