import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compareSerialNo } from "@/lib/utils";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        bridges: {
          include: {
            processes: {
              include: {
                processType: true,
                staff: true,
                staffMembers: { include: { staff: true } },
              },
              orderBy: [{ processType: { order: "asc" } }, { iteration: "asc" }],
            },
          },
        },
      },
    });
    if (!project) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

    // 橋梁をナチュラルソート（整理番号を数値として比較）
    project.bridges.sort((a, b) => compareSerialNo(a.serialNo, b.serialNo));

    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, client, fiscalYear, deadline, note, displayOrder } = await req.json();
    const project = await prisma.project.update({
      where: { id: parseInt(params.id) },
      data: {
        name,
        client,
        fiscalYear,
        deadline: deadline ? new Date(deadline) : null,
        note,
        ...(typeof displayOrder === "number" ? { displayOrder } : {}),
      },
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
