import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/assignments/shift-all
// body: { staffId, fiscalYear, shiftDays, force? }
// 担当者の全割り当てを shiftDays 日ずらす
export async function PUT(req: NextRequest) {
  try {
    const { staffId, fiscalYear, shiftDays, force } = await req.json();
    const days = parseInt(shiftDays);
    const year = parseInt(fiscalYear);

    const assignments = await prisma.bridgeAssignment.findMany({
      where: { staffId: parseInt(staffId), fiscalYear: year },
    });

    if (assignments.length === 0) {
      return NextResponse.json({ error: "割り当てが見つかりません" }, { status: 404 });
    }

    // 制約チェック：点検完了日+8日より前にならないか
    const violations: Array<{ bridgeId: number; bridgeName?: string; limit: string; newStart: string }> = [];

    for (const a of assignments) {
      if (!a.startDate) continue;
      const newStart = new Date(a.startDate);
      newStart.setDate(newStart.getDate() + days);

      if (a.inspectionDoneDate) {
        const limit = new Date(a.inspectionDoneDate);
        limit.setDate(limit.getDate() + 8);
        if (newStart < limit) {
          violations.push({
            bridgeId: a.bridgeId,
            limit: limit.toISOString().slice(0, 10),
            newStart: newStart.toISOString().slice(0, 10),
          });
        }
      }
    }

    if (violations.length > 0 && !force) {
      return NextResponse.json({ violations, requireForce: true }, { status: 409 });
    }

    // 全レコードを更新
    for (const a of assignments) {
      if (!a.startDate && !a.endDate) continue;
      const newStart = a.startDate ? new Date(a.startDate) : null;
      const newEnd = a.endDate ? new Date(a.endDate) : null;
      if (newStart) newStart.setDate(newStart.getDate() + days);
      if (newEnd) newEnd.setDate(newEnd.getDate() + days);

      await prisma.bridgeAssignment.update({
        where: { id: a.id },
        data: { startDate: newStart, endDate: newEnd, isManual: true },
      });
    }

    const updated = await prisma.bridgeAssignment.findMany({
      where: { staffId: parseInt(staffId), fiscalYear: year },
      include: { bridge: true, staff: true },
    });

    return NextResponse.json({ updated: updated.length, assignments: updated });
  } catch {
    return NextResponse.json({ error: "一括移動失敗" }, { status: 500 });
  }
}
