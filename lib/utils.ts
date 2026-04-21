// ステータスの表示名
export const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "未着手",
  IN_PROGRESS: "作業中",
  COMPLETED: "完了",
  DELAYED: "遅延",
};

// ステータスの色クラス（Tailwind CSS）
export const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  DELAYED: "bg-red-100 text-red-700",
};

// 担当者種別の表示名
export const STAFF_TYPE_LABELS: Record<string, string> = {
  EMPLOYEE: "社員",
  CONTRACT: "契約社員",
  PART_TIME: "アルバイト",
};

// 遅延判定（完了予定日が今日より前かつ未完了）
export function isDelayed(
  endDate: Date | string | null | undefined,
  completedDate: Date | string | null | undefined
): boolean {
  if (!endDate || completedDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(endDate) < today;
}

// 工程レコードの実効ステータスを取得（日付から自動判定）
export function getEffectiveStatus(record: {
  status: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  completedDate?: Date | string | null;
}): string {
  // 完了日が入力済み → 完了
  if (record.completedDate) return "COMPLETED";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 完了予定日が過去 → 遅延
  if (record.endDate && new Date(record.endDate) < today) return "DELAYED";

  // 着手予定日が今日以前 → 作業中
  if (record.startDate && new Date(record.startDate) <= today) return "IN_PROGRESS";

  // 着手予定日が未来 → 未着手
  if (record.startDate && new Date(record.startDate) > today) return "NOT_STARTED";

  // 日付未入力の場合は保存済みステータスをそのまま返す
  return record.status;
}

// 橋梁の「現在工程」表示ロジック
export function getCurrentProcess(
  processes: Array<{
    completedDate: Date | string | null | undefined;
    startDate: Date | string | null | undefined;
    processType: { name: string; order: number };
  }>
): string {
  if (processes.length === 0) return "未入力";
  const allCompleted = processes.every((p) => p.completedDate);
  if (allCompleted) return "完了";
  // 完了していない中で startDate が最も早い工程
  const inProgress = processes
    .filter((p) => !p.completedDate && p.startDate)
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());
  if (inProgress.length > 0) return inProgress[0].processType.name;
  // startDate 未入力の最小 order
  const notStarted = processes
    .filter((p) => !p.completedDate)
    .sort((a, b) => a.processType.order - b.processType.order);
  return notStarted[0]?.processType.name ?? "未入力";
}

// 日付を日本語形式にフォーマット（例: 2026/04/07）
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 日付を input[type=date] 用の文字列にフォーマット（例: 2026-04-07）
export function toInputDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

// 月の日数を返す
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// 曜日判定（0=日, 6=土）
export function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

// YYYY-MM 形式から { year, month } を取得
export function parseYearMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, month: m };
}

// 前月・翌月の YYYY-MM を返す
export function prevMonth(ym: string): string {
  const { year, month } = parseYearMonth(ym);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function nextMonth(ym: string): string {
  const { year, month } = parseYearMonth(ym);
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 今月の YYYY-MM
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ガントバーの left% と width% を計算
export function calcGanttBar(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
  year: number,
  month: number
): { left: number; width: number } | null {
  const daysInMonth = getDaysInMonth(year, month);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, daysInMonth, 23, 59, 59);

  if (!startDate) return null;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(startDate);

  // 表示月外なら非表示
  if (start > monthEnd || end < monthStart) return null;

  // 月内に切り詰め
  const clampedStart = start < monthStart ? monthStart : start;
  const clampedEnd = end > monthEnd ? monthEnd : end;

  const startDay = clampedStart.getDate();
  const endDay = clampedEnd.getDate();

  const left = ((startDay - 1) / daysInMonth) * 100;
  const width = Math.max(((endDay - startDay + 1) / daysInMonth) * 100, 100 / daysInMonth);

  return { left, width };
}
