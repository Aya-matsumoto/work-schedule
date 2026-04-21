import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const bridge = await prisma.bridge.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        project: true,
        processes: {
          include: { processType: true, staff: true },
          orderBy: [{ processType: { order: "asc" } }, { iteration: "asc" }],
        },
      },
    });
    if (!bridge) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    return NextResponse.json(bridge);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.bridge.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除失敗" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, serialNo, spans, inspectionDate, inspectionNote } = await req.json();
    const bridge = await prisma.bridge.update({
      where: { id: parseInt(params.id) },
      data: {
        name,
        serialNo,
        spans: spans ? parseInt(spans) : null,
        inspectionDate: inspectionDate ? new Date(inspectionDate) : null,
        inspectionNote,
      },
    });
    return NextResponse.json(bridge);
  } catch {
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}
