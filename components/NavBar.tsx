"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "ダッシュボード", exact: true },
  { href: "/staff", label: "担当者稼働", exact: false },
  { href: "/schedule/auto-assign", label: "工程割り振り", exact: false },
  null,
  { href: "/bridges/settings", label: "径間係数設定", exact: false },
  { href: "/settings/shift", label: "シフト設定", exact: false },
  { href: "/settings/system", label: "システム設定", exact: false },
  null,
  { href: "/settings", label: "マスタ管理", exact: true },
];

export default function NavBar() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-6 h-14">
        <Link href="/" className="font-bold text-blue-700 text-lg whitespace-nowrap">
          橋梁点検 進捗管理
        </Link>
        <div className="flex gap-1 text-sm flex-wrap items-center">
          {links.map((link, i) =>
            link === null ? (
              <span key={i} className="text-gray-300 px-1">|</span>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded transition-colors ${
                  isActive(link.href, link.exact)
                    ? "bg-blue-600 text-white font-medium"
                    : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                }`}
              >
                {link.label}
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
