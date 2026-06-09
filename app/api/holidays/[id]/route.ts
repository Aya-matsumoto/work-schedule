import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE /api/holidays/[id]
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.holiday.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除失敗" }, { status: 500 });
  }
}
