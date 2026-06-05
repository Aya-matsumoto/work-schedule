import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULTS: Record<string, { value: string; description: string }> = {
  default_span_coefficient: { value: "4", description: "径間係数のデフォルト値（1径間あたりの作業時間）" },
  fiscal_year_start_month: { value: "4", description: "年度開始月" },
  hours_per_day_base: { value: "8", description: "1日の基準作業時間（時間）" },
};

// GET /api/settings
export async function GET() {
  try {
    const rows = await prisma.systemSettings.findMany();
    const result: Record<string, string> = {};

    // デフォルト値を先に設定
    for (const [k, v] of Object.entries(DEFAULTS)) {
      result[k] = v.value;
    }
    // DBの値で上書き
    for (const row of rows) {
      result[row.key] = row.value;
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

// POST /api/settings  — { key, value } または { settings: { key: value, ... } }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entries: [string, string][] = body.settings
      ? Object.entries(body.settings)
      : [[body.key, body.value]];

    for (const [key, value] of entries) {
      await prisma.systemSettings.upsert({
        where: { key },
        update: { value: String(value) },
        create: {
          key,
          value: String(value),
          description: DEFAULTS[key]?.description ?? null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "保存失敗" }, { status: 500 });
  }
}
