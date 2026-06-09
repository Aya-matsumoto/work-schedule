import { getDaysInMonth, isWeekend } from "@/lib/utils";

interface Props {
  year: number;
  month: number;
  holidays?: string[]; // "YYYY-MM-DD" 形式の公休日リスト
  children: React.ReactNode;
}

export default function GanttGrid({ year, month, holidays = [], children }: Props) {
  const daysInMonth = getDaysInMonth(year, month);
  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDay = today.getDate();

  // 当月の休日を日(number)のSetに変換して高速判定
  const holidayDays = new Set<number>();
  for (const h of holidays) {
    const [hy, hm, hd] = h.split("-").map(Number);
    if (hy === year && hm === month) holidayDays.add(hd);
  }

  const isOff = (day: number) => isWeekend(year, month, day) || holidayDays.has(day);

  return (
    <div className="relative">
      {/* 日付ヘッダー */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const off = isOff(day);
          const isHoliday = holidayDays.has(day);
          return (
            <div
              key={day}
              className={`flex-1 text-center text-xs py-1 border-r border-gray-100 ${
                isHoliday ? "text-red-400" : off ? "text-gray-400" : "text-gray-500"
              }`}
              title={isHoliday ? holidays.find((h) => h.endsWith(`-${String(day).padStart(2, "0")}`)) : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>
      {/* グリッド本体 */}
      <div className="relative">
        {/* 土日・休日の背景 */}
        <div className="absolute inset-0 flex pointer-events-none">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const off = isOff(day);
            const isHoliday = holidayDays.has(day);
            return (
              <div
                key={day}
                className={`flex-1 ${isHoliday ? "bg-red-50" : off ? "bg-gray-50" : ""}`}
              />
            );
          })}
        </div>
        {/* 今日の縦線 */}
        {isThisMonth && (
          <div
            className="absolute top-0 bottom-0 w-px bg-red-400 pointer-events-none z-10"
            style={{ left: `${((todayDay - 0.5) / daysInMonth) * 100}%` }}
          />
        )}
        {children}
      </div>
    </div>
  );
}
