import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        bridges: {
          include: {
            processes: {
              include: { processType: true, staff: true },
              orderBy: [{ processType: { order: "asc" } }, { iteration: "asc" }],
            },
          },
          orderBy: { serialNo: "asc" },
        },
      },
    });
    if (!project) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, client, fiscalYear, deadline, note } = await req.json();
    const project = await prisma.project.update({
      where: { id: parseInt(params.id) },
      data: { name, client, fiscalYear, deadline: deadline ? new Date(deadline) : null, note },
    });
    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.project.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除失敗" }, { status: 500 });
  }
}
