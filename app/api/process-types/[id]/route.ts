import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, order, color } = await req.json();
    const pt = await prisma.processType.update({
      where: { id: parseInt(params.id) },
      data: { name, order, color },
    });
    return NextResponse.json(pt);
  } catch {
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    const count = await prisma.processRecord.count({ where: { processTypeId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: `この工程種別は ${count} 件の工程レコードに使用されているため削除できません` },
        { status: 409 }
      );
    }
    await prisma.processType.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除失敗" }, { status: 500 });
  }
}
