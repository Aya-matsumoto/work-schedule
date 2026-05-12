import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/shifts/[staffId]/overrides
export async function GET(_: NextRequest, { params }: { params: { staffId: string } }) {
  try {
    const shift = await prisma.staffShift.findFirst({
      where: { staffId: parseInt(params.staffId), validTo: null },
      include: { overrides: { orderBy: { date: "asc" } } },
    });
    return NextResponse.json(shift?.overrides ?? []);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

// POST /api/shifts/[staffId]/overrides
export async function POST(req: NextRequest, { params }: { params: { staffId: string } }) {
  try {
    const { date, hoursPerDay, note } = await req.json();

    const shift = await prisma.staffShift.findFirst({
      where: { staffId: parseInt(params.staffId), validTo: null },
    });
    if (!shift) {
      return NextResponse.json({ error: "シフトが見つかりません" }, { status: 404 });
    }

    const override = await prisma.staffShiftOverride.create({
      data: {
        shiftId: shift.id,
        date: new Date(date),
        hoursPerDay: parseFloat(hoursPerDay),
        note: note || null,
      },
    });
    return NextResponse.json(override, { status: 201 });
  } catch {
    return NextResponse.json({ error: "保存失敗" }, { status: 500 });
  }
}
