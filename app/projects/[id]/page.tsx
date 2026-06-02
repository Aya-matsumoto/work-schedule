"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { getCurrentProcess, getEffectiveStatus, formatDate } from "@/lib/utils";

interface ProcessRecord {
  id: number; status: string; startDate: string | null; endDate: string | null;
  completedDate: string | null;
  staff: { id: number; name: string } | null;
  processType: { id: number; name: string; order: number; color: string };
}

interface Bridge {
  id: number; name: string; serialNo: string | null; spans: number | null;
  processes: ProcessRecord[];
}

interface Project {
  id: number; name: string; client: string | null; deadline: string | null; bridges: Bridge[];
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStaff, setFilterStaff] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProcess, setFilterProcess] = useState("");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${params.id}`).then((r) => r.json()).then((data) => { setProject(data); setLoading(false); });
  }, [params.id]);

  if (loading) return <div className="py-8 text-center text-gray-400">読み込み中...</div>;
  if (!project) return <div className="py-8 text-center text-red-500">業務が見つかりません</div>;

  const staffNames = [...new Set(project.bridges.flatMap((b) => b.processes.map((p) => p.staff?.name)).filter(Boolean))] as string[];
  const processNames = [...new Set(project.bridges.flatMap((b) => b.processes.map((p) => p.processType.name)))];

  const filteredBridges = project.bridges.filter((bridge) => {
    if (searchText && !bridge.name.includes(searchText)) return false;
    const currentProcess = getCurrentProcess(bridge.processes);
    if (filterProcess && currentProcess !== filterProcess) return false;
    if (filterStaff || filterStatus) {
      const matches = bridge.processes.some((p) => {
        if (filterStaff && p.staff?.name !== filterStaff) return false;
        if (filterStatus && getEffectiveStatus(p) !== filterStatus) return false;
        return true;
      });
      if (!matches) return false;
    }
    return true;
  });

  return (
    <div className="d3-body">
      <div className="d3-headrow">
        <div>
          <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--muted)" }}>
            <Link href="/" className="hover:underline">ダッシュボード</Link>
            <span>›</span>
            <span>{project.name}</span>
          </div>
          <h1 className="d3-h1"><span className="em">{project.name}</span></h1>
          <div className="d3-hsub">
            {project.client && <span className="mr-3">{project.client}</span>}
            橋梁数：{project.bridges.length}橋
            {project.deadline && `　期限：${formatDate(project.deadline)}`}
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="d3-panel mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>橋梁名検索</label>
          <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="橋梁名..." className="d3-input w-36" />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>担当者</label>
          <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="d3-input">
            <option value="">すべて</option>
            {staffNames.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>現在工程</label>
          <select value={filterProcess} onChange={(e) => setFilterProcess(e.target.value)} className="d3-input">
            <option value="">すべて</option>
            {processNames.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>ステータス</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="d3-input">
            <option value="">すべて</option>
            <option value="NOT_STARTED">未着手</option>
            <option value="IN_PROGRESS">作業中</option>
            <option value="COMPLETED">完了</option>
            <option value="DELAYED">遅延</option>
          </select>
        </div>
        {(filterStaff || filterStatus || filterProcess || searchText) && (
          <button onClick={() => { setFilterStaff(""); setFilterStatus(""); setFilterProcess(""); setSearchText(""); }} className="d3-ghost">クリア</button>
        )}
        <span className="ml-auto text-sm" style={{ color: "var(--muted)" }}>{filteredBridges.length}件</span>
      </div>

      {/* テーブル */}
      <div className="d3-card">
        <table className="d3-table">
          <thead>
            <tr>
              <th>整理番号</th>
              <th>橋梁名</th>
              <th>現在工程</th>
              <th>担当者</th>
              <th>完了予定日</th>
              <th>ステータス</th>
            </tr>
          </thead>
          <tbody>
            {filteredBridges.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8" style={{ color: "var(--muted)" }}>該当する橋梁がありません</td></tr>
            ) : filteredBridges.map((bridge) => {
              const currentProcessName = getCurrentProcess(bridge.processes);
              const currentRecord = bridge.processes.find((p) => p.processType.name === currentProcessName && !p.completedDate);
              const overallStatus = bridge.processes.some((p) => getEffectiveStatus(p) === "DELAYED") ? "DELAYED"
                : bridge.processes.length === 0 ? "NOT_STARTED"
                : bridge.processes.every((p) => p.completedDate) ? "COMPLETED"
                : bridge.processes.some((p) => p.startDate) ? "IN_PROGRESS"
                : "NOT_STARTED";
              return (
                <tr key={bridge.id} className="cursor-pointer hover:bg-blue-50" onClick={() => router.push(`/bridges/${bridge.id}`)}>
                  <td style={{ color: "var(--muted)" }}>{bridge.serialNo ?? "-"}</td>
                  <td className="font-medium" style={{ color: "var(--ink)" }}>{bridge.name}</td>
                  <td>{currentProcessName}</td>
                  <td style={{ color: "var(--muted)" }}>{currentRecord?.staff?.name ?? "-"}</td>
                  <td style={{ color: "var(--muted)" }}>{currentRecord?.endDate ? formatDate(currentRecord.endDate) : "-"}</td>
                  <td><StatusBadge status={overallStatus} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
