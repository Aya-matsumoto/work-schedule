"use client";
import { useState, useRef, useEffect } from "react";

interface Staff { id: number; name: string; }

interface Props {
  staff: Staff[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export default function MultiStaffSelect({ staff, selectedIds, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: number) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    );
  };

  const label =
    selectedIds.length === 0
      ? "未定"
      : staff
          .filter((s) => selectedIds.includes(s.id))
          .map((s) => s.name)
          .join("・");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border border-gray-300 rounded px-2 py-1 text-sm w-full text-left truncate hover:border-blue-400 focus:outline-none focus:border-blue-500"
      >
        {label}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-max">
          {staff.map((s) => (
            <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 text-sm select-none">
              <input
                type="checkbox"
                checked={selectedIds.includes(s.id)}
                onChange={() => toggle(s.id)}
                className="accent-blue-600"
              />
              {s.name}
            </label>
          ))}
          {staff.length === 0 && <span className="px-3 py-1.5 text-xs text-gray-400">担当者未登録</span>}
        </div>
      )}
    </div>
  );
}
