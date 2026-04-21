import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { processTypeId, staffId, startDate, endDate, completedDate, note, iteration, status } = await req.json();
    let effectiveStatus = status ?? "NOT_STARTED";
    if (completedDate) effectiveStatus = "COMPLETED";
    else if (startDate) effectiveStatus = "IN_PROGRESS";

    const record = await prisma.processRecord.create({
      data: {
        bridgeId: parseInt(params.id),
        processTypeId: parseInt(processTypeId),
        staffId: staffId ? parseInt(staffId) : null,
        status: effectiveStatus,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        completedDate: completedDate ? new Date(completedDate) : null,
        note,
        iteration: iteration ?? 1,
      },
      include: { processType: true, staff: true },
    });
    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json({ error: "追加失敗" }, { status: 500 });
  }
}
