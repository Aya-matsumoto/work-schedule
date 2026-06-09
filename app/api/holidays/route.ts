import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/holidays  → 全休日を日付昇順で返す
export async function GET() {
  try {
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: "asc" },
    });
    // 日付をローカル "YYYY-MM-DD" 文字列に変換して返す
    return NextResponse.json(
      holidays.map((h) => ({
        id: h.id,
        name: h.name,
        date: toLocalDateStr(h.date),
      }))
    );
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

// POST /api/holidays  → 休日を追加
export async function POST(req: NextRequest) {
  try {
    const { date, name } = await req.json();
    if (!date) return NextResponse.json({ error: "日付は必須です" }, { status: 400 });

    const [y, m, d] = date.split("-").map(Number);
    const holiday = await prisma.holiday.create({
      data: { date: new Date(y, m - 1, d), name: name ?? "" },
    });
    return NextResponse.json(
      { id: holiday.id, name: holiday.name, date: toLocalDateStr(holiday.date) },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "作成失敗" }, { status: 500 });
  }
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
