import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { staffId, staffIds, startDate, endDate, completedDate, note, status } = await req.json();

    let effectiveStatus = status ?? "NOT_STARTED";
    if (completedDate) {
      effectiveStatus = "COMPLETED";
    } else if (status === "COMPLETED") {
      effectiveStatus = startDate ? "IN_PROGRESS" : "NOT_STARTED";
    }

    // staffIds が渡された場合は複数担当者として扱う
    const ids: number[] = staffIds && Array.isArray(staffIds) && staffIds.length > 0
      ? staffIds.map(Number)
      : staffId ? [Number(staffId)] : [];

    const primaryStaffId = ids.length > 0 ? ids[0] : null;
    const recordId = parseInt(params.id);

    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.processRecord.update({
        where: { id: recordId },
        data: {
          staffId: primaryStaffId,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          completedDate: completedDate ? new Date(completedDate) : null,
          note,
          status: effectiveStatus,
        },
      });

      // 担当者の同期
      await tx.processRecordStaff.deleteMany({ where: { processRecordId: recordId } });
      if (ids.length > 0) {
        await tx.processRecordStaff.createMany({
          data: ids.map((sid) => ({ processRecordId: recordId, staffId: sid })),
        });
      }

      // 対の割り振り(BridgeAssignment)があれば日程・担当を同期し、ガント表示とのズレを防ぐ。
      // （割り振りは同橋梁・同工程種別に存在。iteration:1 の工程レコードと対応）
      if (updated.bridgeId != null && updated.iteration === 1) {
        await tx.bridgeAssignment.updateMany({
          where: { bridgeId: updated.bridgeId, processTypeId: updated.processTypeId },
          data: {
            startDate: updated.startDate,
            endDate: updated.endDate,
            staffId: primaryStaffId ?? undefined,
            isManual: true,
          },
        });
      }

      return tx.processRecord.findUnique({
        where: { id: recordId },
        include: {
          processType: true,
          staff: true,
          staffMembers: { include: { staff: true } },
        },
      });
    });

    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    await prisma.$transaction(async (tx) => {
      const rec = await tx.processRecord.findUnique({ where: { id } });
      await tx.processRecord.delete({ where: { id } }); // ProcessRecordStaff は onDelete:Cascade で消える
      // 対の割り振りも連動削除（残すとガントに割り振りバーが復活して見えるため）
      if (rec && rec.bridgeId != null && rec.iteration === 1) {
        await tx.bridgeAssignment.deleteMany({
          where: { bridgeId: rec.bridgeId, processTypeId: rec.processTypeId },
        });
      }
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除失敗" }, { status: 500 });
  }
}
