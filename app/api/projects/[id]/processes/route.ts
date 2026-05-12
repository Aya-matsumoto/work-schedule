import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/projects/[id]/processes — 業務に直接工程を登録
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = parseInt(params.id);
    const { processTypeId, staffId, startDate, endDate, note } = await req.json();

    const record = await prisma.processRecord.create({
      data: {
        projectId,
        bridgeId: null,
        processTypeId: parseInt(processTypeId),
        staffId: staffId ? parseInt(staffId) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        note: note || null,
        status: startDate ? "IN_PROGRESS" : "NOT_STARTED",
      },
      include: { processType: true, staff: true },
    });

    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json({ error: "登録失敗" }, { status: 500 });
  }
}
