import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// "YYYY-MM-DD" or "YYYY/MM/DD" → Date（ローカル時刻）
function parseDate(s: string | null | undefined): Date | null {
  if (!s || s.trim() === "") return null;
  const normalized = s.trim().replace(/\//g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  return new Date(y, m - 1, d);
}

export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json();
    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      const { projectName, client, bridgeName, serialNo, spans, inspectionDate } = row;
      if (!projectName || !bridgeName) {
        results.errors.push("業務名・橋梁名が空の行をスキップしました");
        results.skipped++;
        continue;
      }

      // 業務を探す・なければ作成
      let project = await prisma.project.findFirst({ where: { name: projectName } });
      if (!project) {
        project = await prisma.project.create({
          data: {
            name: projectName,
            client: client || null,
            fiscalYear: projectName.match(/^[A-Z]\d+/)?.[0] ?? null,
          },
        });
      } else if (client && !project.client) {
        // 元請けが未設定なら更新
        project = await prisma.project.update({
          where: { id: project.id },
          data: { client },
        });
      }

      const spansNum = spans ? parseInt(spans) : null;
      const inspectionDateVal = parseDate(inspectionDate);

      // 既存橋梁を探す（業務ID + 橋梁名）
      const existing = await prisma.bridge.findFirst({
        where: { projectId: project.id, name: bridgeName },
      });

      if (existing) {
        // 既存の場合は上書き更新
        await prisma.bridge.update({
          where: { id: existing.id },
          data: {
            serialNo: serialNo || existing.serialNo,
            spans: spansNum ?? existing.spans,
            inspectionDate: inspectionDateVal ?? existing.inspectionDate,
          },
        });
        results.updated++;
      } else {
        // 新規作成
        await prisma.bridge.create({
          data: {
            projectId: project.id,
            name: bridgeName,
            serialNo: serialNo || null,
            spans: spansNum,
            inspectionDate: inspectionDateVal,
          },
        });
        results.created++;
      }
    }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "インポート失敗" }, { status: 500 });
  }
}
