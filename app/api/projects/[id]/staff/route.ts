import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id]/staff - 業務に割り当てられた担当者一覧
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id);

  const assignments = await prisma.projectStaff.findMany({
    where: { projectId },
    include: { staff: true },
    orderBy: { priority: "asc" },
  });

  return NextResponse.json(assignments.map((a) => ({
    id: a.id,
    staffId: a.staffId,
    priority: a.priority,
    name: a.staff.name,
    color: a.staff.color,
    type: a.staff.type,
  })));
}

// PUT /api/projects/[id]/staff - 業務担当者を一括更新
// body: { staffIds: number[] }  // 空配列で全員削除
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id);
  const { staffIds } = await req.json();

  if (!Array.isArray(staffIds)) {
    return NextResponse.json({ error: "staffIds は配列で指定してください" }, { status: 400 });
  }

  // 既存を全削除 → 新規追加（順番を priority で保持）
  await prisma.projectStaff.deleteMany({ where: { projectId } });

  if (staffIds.length > 0) {
    await prisma.projectStaff.createMany({
      data: staffIds.map((staffId: number, i: number) => ({
        projectId,
        staffId,
        priority: i + 1,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
