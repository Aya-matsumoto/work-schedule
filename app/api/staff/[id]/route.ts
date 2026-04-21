import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, type, color } = await req.json();
    const staff = await prisma.staff.update({
      where: { id: parseInt(params.id) },
      data: { name, type, color },
    });
    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    // 紐づく ProcessRecord の staffId を null に
    await prisma.processRecord.updateMany({ where: { staffId: id }, data: { staffId: null } });
    await prisma.staff.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除失敗" }, { status: 500 });
  }
}
