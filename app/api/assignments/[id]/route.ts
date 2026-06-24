import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/assignments/[id] — 単体手動修正
// 割り振り(BridgeAssignment)と対の工程レコード(ProcessRecord)は別レコードのため、
// 片方だけ更新すると画面間（ガント=割り振り / リスト・詳細=工程レコード）でズレる。
// 割り振り編集時は、同橋梁・同工程種別・iteration:1 の工程レコードも同期する。
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { startDate, endDate, staffId, inspectionDoneDate } = await req.json();
    const id = parseInt(params.id);

    const assignment = await prisma.$transaction(async (tx) => {
      const updated = await tx.bridgeAssignment.update({
        where: { id },
        data: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          staffId: staffId ? parseInt(staffId) : undefined,
          inspectionDoneDate: inspectionDoneDate ? new Date(inspectionDoneDate) : undefined,
          isManual: true,
        },
        include: { bridge: true, staff: true },
      });

      // 対の工程レコードを割り振りに合わせて同期
      if (updated.processTypeId != null) {
        const paired = await tx.processRecord.findMany({
          where: { bridgeId: updated.bridgeId, processTypeId: updated.processTypeId, iteration: 1 },
          select: { id: true },
        });
        for (const rec of paired) {
          await tx.processRecord.update({
            where: { id: rec.id },
            data: { startDate: updated.startDate, endDate: updated.endDate, staffId: updated.staffId },
          });
          // 担当者一覧も主担当に揃える（自動割り振り対象工程は単一担当）
          await tx.processRecordStaff.deleteMany({ where: { processRecordId: rec.id } });
          await tx.processRecordStaff.create({ data: { processRecordId: rec.id, staffId: updated.staffId } });
        }
      }
      return updated;
    });

    return NextResponse.json(assignment);
  } catch {
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

// DELETE /api/assignments/[id]
// 自動割り振り（BridgeAssignment）は、同じ橋梁×工程種別の ProcessRecord と
// セットで作成される（assignments/auto 参照）。ダッシュボードのガントでは
// 割り振りがある工程の ProcessRecord バーは非表示にしているため、
// 割り振りだけ削除すると裏に ProcessRecord が孤児として残り、
// 再読込時に工程バーとして「復活」して見える。
// これを防ぐため、割り振り削除時に対応する ProcessRecord（iteration:1）も連動削除する。
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    await prisma.$transaction(async (tx) => {
      const assignment = await tx.bridgeAssignment.findUnique({ where: { id } });
      await tx.bridgeAssignment.delete({ where: { id } });

      if (assignment && assignment.processTypeId != null) {
        const orphans = await tx.processRecord.findMany({
          where: {
            bridgeId: assignment.bridgeId,
            processTypeId: assignment.processTypeId,
            iteration: 1,
          },
          select: { id: true },
        });
        if (orphans.length > 0) {
          const ids = orphans.map((r) => r.id);
          await tx.processRecordStaff.deleteMany({ where: { processRecordId: { in: ids } } });
          await tx.processRecord.deleteMany({ where: { id: { in: ids } } });
        }
      }
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除失敗" }, { status: 500 });
  }
}
