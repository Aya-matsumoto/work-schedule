import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id]/process-staff
// → [{ processTypeName, staffIds }]
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = parseInt(params.id);
    const rows = await prisma.projectProcessStaff.findMany({
      where: { projectId },
      orderBy: [{ processTypeName: "asc" }, { staffId: "asc" }],
    });

    // processTypeName ごとに staffId をまとめる
    const map = new Map<string, number[]>();
    for (const row of rows) {
      const arr = map.get(row.processTypeName) ?? [];
      arr.push(row.staffId);
      map.set(row.processTypeName, arr);
    }

    const result = Array.from(map.entries()).map(([processTypeName, staffIds]) => ({
      processTypeName,
      staffIds,
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

// PUT /api/projects/[id]/process-staff
// body: [{ processTypeName, staffIds: number[] }]
// → 指定プロジェクトの全工程担当者を置き換え
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = parseInt(params.id);
    const entries: { processTypeName: string; staffIds: number[] }[] = await req.json();

    // 既存を全削除して登録し直す
    await prisma.projectProcessStaff.deleteMany({ where: { projectId } });

    const data = entries.flatMap(({ processTypeName, staffIds }) =>
      staffIds.map((staffId) => ({ projectId, staffId, processTypeName }))
    );

    if (data.length > 0) {
      await prisma.projectProcessStaff.createMany({ data, skipDuplicates: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存失敗" }, { status: 500 });
  }
}
