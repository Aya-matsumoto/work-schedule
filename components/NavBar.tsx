"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "ダッシュボード", exact: true },
  { href: "/staff", label: "担当者稼働", exact: false },
  { href: "/schedule/auto-assign", label: "工程割り振り", exact: false },
  { href: "/bridges/settings", label: "径間係数設定", exact: false },
  { href: "/settings/shift", label: "シフト設定", exact: false },
  { href: "/settings/system", label: "システム設定", exact: false },
  { href: "/settings", label: "マスタ管理", exact: true },
];

const BridgeSvg = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 16c4 0 4-6 10-6s6 6 10 6"/>
    <path d="M2 16v3M22 16v3M8 13v6M16 13v6M12 11v8"/>
  </svg>
);

export default function NavBar() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="d3-top">
      {/* ロゴ */}
      <Link href="/" className="d3-brand">
        <span className="d3-logo"><BridgeSvg /></span>
        <span>橋梁点検 <span className="bt">進捗管理</span></span>
      </Link>

      {/* ナビ */}
      <nav className="d3-nav">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={isActive(link.href, link.exact) ? "on" : ""}
          >
            {link.label}
          </Link>
        ))}
        <a href="/manual.html" target="_blank" rel="noopener noreferrer">
          使い方
        </a>
      </nav>

    </div>
  );
}
