import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/assignments/[id] — 単体手動修正
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { startDate, endDate, staffId, inspectionDoneDate } = await req.json();
    const assignment = await prisma.bridgeAssignment.update({
      where: { id: parseInt(params.id) },
      data: {
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        staffId: staffId ? parseInt(staffId) : undefined,
        inspectionDoneDate: inspectionDoneDate ? new Date(inspectionDoneDate) : undefined,
        isManual: true,
      },
      include: { bridge: true, staff: true },
    });
    return NextResponse.json(assignment);
  } catch {
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

// DELETE /api/assignments/[id]
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.bridgeAssignment.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除失敗" }, { status: 500 });
  }
}
