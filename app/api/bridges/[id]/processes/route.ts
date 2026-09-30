import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { processTypeId, staffId, staffIds, startDate, endDate, completedDate, note, iteration, status } = await req.json();
    let effectiveStatus = status ?? "NOT_STARTED";
    if (completedDate) effectiveStatus = "COMPLETED";
    else if (startDate) effectiveStatus = "IN_PROGRESS";

    const ids: number[] = staffIds && Array.isArray(staffIds) && staffIds.length > 0
      ? staffIds.map(Number)
      : staffId ? [Number(staffId)] : [];

    const primaryStaffId = ids.length > 0 ? ids[0] : null;

    const bridgeId = parseInt(params.id);

    const record = await prisma.$transaction(async (tx) => {
      // iteration 未指定（ダッシュボードからの登録など）の場合は、同橋梁・同工程の既存件数に続く番号を振る。
      // 常に1で登録すると「調書作成」が重複し、2件目がガントに出ない・詳細画面から削除できない不具合になるため。
      let effectiveIteration: number = iteration ?? 1;
      if (iteration == null) {
        const agg = await tx.processRecord.aggregate({
          where: { bridgeId, processTypeId: parseInt(processTypeId) },
          _max: { iteration: true },
        });
        effectiveIteration = (agg._max.iteration ?? 0) + 1;
      }

      const created = await tx.processRecord.create({
        data: {
          bridgeId,
          processTypeId: parseInt(processTypeId),
          staffId: primaryStaffId,
          status: effectiveStatus,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          completedDate: completedDate ? new Date(completedDate) : null,
          note,
          iteration: effectiveIteration,
        },
      });

      if (ids.length > 0) {
        await tx.processRecordStaff.createMany({
          data: ids.map((sid) => ({ processRecordId: created.id, staffId: sid })),
        });
      }

      return tx.processRecord.findUnique({
        where: { id: created.id },
        include: {
          processType: true,
          staff: true,
          staffMembers: { include: { staff: true } },
        },
      });
    });

    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json({ error: "追加失敗" }, { status: 500 });
  }
}
