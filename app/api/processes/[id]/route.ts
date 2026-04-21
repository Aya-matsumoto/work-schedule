import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { staffId, startDate, endDate, completedDate, note, status } = await req.json();

    let effectiveStatus = status ?? "NOT_STARTED";
    if (completedDate) {
      effectiveStatus = "COMPLETED";
    } else if (status === "COMPLETED") {
      effectiveStatus = startDate ? "IN_PROGRESS" : "NOT_STARTED";
    }

    const record = await prisma.processRecord.update({
      where: { id: parseInt(params.id) },
      data: {
        staffId: staffId ? parseInt(staffId) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        completedDate: completedDate ? new Date(completedDate) : null,
        note,
        status: effectiveStatus,
      },
      include: { processType: true, staff: true },
    });
    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.processRecord.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除失敗" }, { status: 500 });
  }
}
