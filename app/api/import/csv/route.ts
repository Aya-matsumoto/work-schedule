import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json();
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      const { projectName, client, bridgeName, serialNo, spans } = row;
      if (!projectName || !bridgeName) {
        results.errors.push("業務名・橋梁名が空の行をスキップしました");
        results.skipped++;
        continue;
      }

      let project = await prisma.project.findFirst({ where: { name: projectName } });
      if (!project) {
        project = await prisma.project.create({
          data: { name: projectName, client: client || null, fiscalYear: projectName.match(/^[A-Z]\d+/)?.[0] ?? null },
        });
      }

      const existing = await prisma.bridge.findFirst({ where: { projectId: project.id, name: bridgeName } });
      if (existing) {
        results.errors.push(`${projectName} / ${bridgeName} は既に登録済みのためスキップしました`);
        results.skipped++;
        continue;
      }

      await prisma.bridge.create({
        data: { projectId: project.id, name: bridgeName, serialNo: serialNo || null, spans: spans ? parseInt(spans) : null },
      });
      results.created++;
    }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "インポート失敗" }, { status: 500 });
  }
}
