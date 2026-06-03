"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface Staff { id: number; name: string; }

interface Props {
  staff: Staff[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  singleOnly?: boolean;
}

export default function MultiStaffSelect({ staff, selectedIds, onChange, singleOnly = false }: Props) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; minWidth: number; maxHeight: number }>({ top: 0, left: 0, minWidth: 0, maxHeight: 280 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-multistaff-dropdown]")) setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const maxH = Math.min(280, Math.max(spaceBelow, spaceAbove) - 8);
      const showAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
      setDropdownStyle({
        top: showAbove
          ? rect.top + window.scrollY - maxH - 4
          : rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        minWidth: rect.width,
        maxHeight: maxH,
      });
    }
    setOpen((v) => !v);
  };

  const toggle = (id: number) => {
    if (singleOnly) {
      // 単一選択モード：選択済みなら解除、未選択なら単体選択
      onChange(selectedIds.includes(id) ? [] : [id]);
    } else {
      onChange(
        selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
      );
    }
  };

  const label =
    selectedIds.length === 0
      ? "未定"
      : staff.filter((s) => selectedIds.includes(s.id)).map((s) => s.name).join("・");

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="border border-gray-300 rounded px-2 py-1 text-sm w-full text-left truncate hover:border-blue-400 focus:outline-none focus:border-blue-500"
      >
        {label}
      </button>
      {open && typeof window !== "undefined" && createPortal(
        <div
          data-multistaff-dropdown
          className="fixed z-[9999] bg-white border border-gray-200 rounded shadow-lg py-1"
          style={{ top: dropdownStyle.top, left: dropdownStyle.left, minWidth: dropdownStyle.minWidth, maxHeight: dropdownStyle.maxHeight, overflowY: "auto" }}
        >
          {staff.map((s) => (
            <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 text-sm select-none whitespace-nowrap">
              <input
                type={singleOnly ? "radio" : "checkbox"}
                checked={selectedIds.includes(s.id)}
                onChange={() => toggle(s.id)}
                className="accent-blue-600"
              />
              {s.name}
            </label>
          ))}
          {staff.length === 0 && <span className="px-3 py-1.5 text-xs text-gray-400">担当者未登録</span>}
        </div>,
        document.body
      )}
    </>
  );
}
