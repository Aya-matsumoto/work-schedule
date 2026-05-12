import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "橋梁点検 進捗管理",
  description: "橋梁点検調書作成の進捗管理アプリ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">
        <nav className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-6 h-14">
            <Link href="/" className="font-bold text-blue-700 text-lg whitespace-nowrap">
              橋梁点検 進捗管理
            </Link>
            <div className="flex gap-4 text-sm flex-wrap">
              <Link href="/" className="text-gray-600 hover:text-blue-600 transition-colors">
                ダッシュボード
              </Link>
              <Link href="/staff" className="text-gray-600 hover:text-blue-600 transition-colors">
                担当者稼働
              </Link>
              <Link href="/schedule/auto-assign" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                工程割り振り
              </Link>
              <span className="text-gray-300">|</span>
              <Link href="/bridges/settings" className="text-gray-600 hover:text-blue-600 transition-colors">
                径間係数設定
              </Link>
              <Link href="/settings/shift" className="text-gray-600 hover:text-blue-600 transition-colors">
                シフト設定
              </Link>
              <Link href="/settings/system" className="text-gray-600 hover:text-blue-600 transition-colors">
                システム設定
              </Link>
              <span className="text-gray-300">|</span>
              <Link href="/settings" className="text-gray-600 hover:text-blue-600 transition-colors">
                マスタ管理
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-screen-xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
