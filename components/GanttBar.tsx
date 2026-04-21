"use client";
import { calcGanttBar, formatDate, getDaysInMonth } from "@/lib/utils";
import { useRef } from "react";

interface Props {
  id: number;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  completedDate?: string | null | undefined;
  color: string;
  staffName?: string | null;
  processName: string;
  customLabel?: string;
  year: number;
  month: number;
  onDragEnd?: (id: number, newStart: string, newEnd: string) => void;
  onClick?: (id: number) => void;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function GanttBar({
  id, startDate, endDate, completedDate, color,
  staffName, processName, customLabel, year, month, onDragEnd, onClick,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const daysInMonth = getDaysInMonth(year, month);
  const bar = calcGanttBar(startDate, endDate, year, month);
  if (!bar) return null;

  const label = customLabel ?? staffName ?? processName;
  const tooltip = `${processName}\n担当: ${staffName ?? "未定"}\n${formatDate(startDate)} 〜 ${formatDate(endDate)}${completedDate ? `\n完了: ${formatDate(completedDate)}` : ""}`;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const container = barRef.current?.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const pixelsPerDay = containerRect.width / daysInMonth;
    const startX = e.clientX;
    let deltaDays = 0;
    let hasMoved = false;

    // ドラッグ中のビジュアル更新
    const barEl = barRef.current!;
    const origLeft = bar.left;

    const onMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startX;
      if (Math.abs(deltaX) > 4) hasMoved = true;
      deltaDays = Math.round(deltaX / pixelsPerDay);
      const newLeft = Math.max(0, Math.min(100 - bar.width, origLeft + (deltaDays / daysInMonth) * 100));
      barEl.style.left = `${newLeft}%`;
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      if (!hasMoved) {
        // クリック → 編集
        barEl.style.left = `${origLeft}%`;
        onClick?.(id);
      } else {
        // ドラッグ完了 → 日程更新
        if (deltaDays !== 0 && startDate && onDragEnd) {
          const newStart = addDays(startDate, deltaDays);
          const newEnd = addDays(endDate ?? startDate, deltaDays);
          onDragEnd(id, newStart, newEnd);
        } else {
          barEl.style.left = `${origLeft}%`;
        }
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      ref={barRef}
      title={tooltip}
      className="absolute top-1 bottom-1 rounded flex items-center overflow-hidden select-none cursor-grab active:cursor-grabbing z-10 hover:brightness-110 transition-none"
      style={{ left: `${bar.left}%`, width: `${bar.width}%`, backgroundColor: color }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-white text-xs px-1 truncate font-medium leading-none">
        {completedDate ? "✓ " : ""}{label}
      </span>
    </div>
  );
}
