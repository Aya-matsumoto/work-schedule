import { getDaysInMonth, isWeekend } from "@/lib/utils";

interface Props {
  year: number;
  month: number;
  children: React.ReactNode;
}

export default function GanttGrid({ year, month, children }: Props) {
  const daysInMonth = getDaysInMonth(year, month);
  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDay = today.getDate();

  return (
    <div className="relative">
      {/* 日付ヘッダー */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const weekend = isWeekend(year, month, day);
          return (
            <div
              key={day}
              className={`flex-1 text-center text-xs py-1 border-r border-gray-100 ${weekend ? "text-gray-400" : "text-gray-500"}`}
            >
              {day}
            </div>
          );
        })}
      </div>
      {/* グリッド本体 */}
      <div className="relative">
        {/* 土日背景 */}
        <div className="absolute inset-0 flex pointer-events-none">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            return (
              <div
                key={day}
                className={`flex-1 ${isWeekend(year, month, day) ? "bg-gray-50" : ""}`}
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
