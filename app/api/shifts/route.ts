import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/shifts — 全担当者のシフト一覧
export async function GET() {
  try {
    const shifts = await prisma.staffShift.findMany({
      include: { staff: true, overrides: { orderBy: { date: "asc" } } },
      orderBy: { staffId: "asc" },
    });
    return NextResponse.json(shifts);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

// POST /api/shifts — シフト新規登録・更新（担当者ごとに upsert）
export async function POST(req: NextRequest) {
  try {
    const { staffId, defaultHoursPerDay, weekPattern, validFrom, validTo } = await req.json();

    // 既存の有効シフトを終了させて新規作成
    const existing = await prisma.staffShift.findFirst({
      where: { staffId: parseInt(staffId), validTo: null },
    });

    if (existing) {
      // 既存シフトを更新
      const shift = await prisma.staffShift.update({
        where: { id: existing.id },
        data: {
          defaultHoursPerDay: parseFloat(defaultHoursPerDay),
          weekPattern,
          validFrom: new Date(validFrom),
          validTo: validTo ? new Date(validTo) : null,
        },
        include: { overrides: true },
      });
      return NextResponse.json(shift);
    } else {
      // 新規作成
      const shift = await prisma.staffShift.create({
        data: {
          staffId: parseInt(staffId),
          defaultHoursPerDay: parseFloat(defaultHoursPerDay),
          weekPattern,
          validFrom: new Date(validFrom),
          validTo: validTo ? new Date(validTo) : null,
        },
        include: { overrides: true },
      });
      return NextResponse.json(shift, { status: 201 });
    }
  } catch {
    return NextResponse.json({ error: "保存失敗" }, { status: 500 });
  }
}
