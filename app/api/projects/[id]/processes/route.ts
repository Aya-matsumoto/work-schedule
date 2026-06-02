import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/projects/[id]/processes — 業務に直接工程を登録
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = parseInt(params.id);
    const { processTypeId, staffId, staffIds, startDate, endDate, note } = await req.json();

    const ids: number[] = staffIds && Array.isArray(staffIds) && staffIds.length > 0
      ? staffIds.map(Number)
      : staffId ? [Number(staffId)] : [];

    const primaryStaffId = ids.length > 0 ? ids[0] : null;

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.processRecord.create({
        data: {
          projectId,
          bridgeId: null,
          processTypeId: parseInt(processTypeId),
          staffId: primaryStaffId,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          note: note || null,
          status: startDate ? "IN_PROGRESS" : "NOT_STARTED",
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
    return NextResponse.json({ error: "登録失敗" }, { status: 500 });
  }
}
