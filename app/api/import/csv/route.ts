import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 全角数字 → 半角数字
function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

// 日付文字列 → Date（ローカル時刻）
// 対応形式：YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, YYYY年M月D日
function parseDate(s: string | null | undefined): Date | null {
  if (!s || s.trim() === "") return null;
  let str = toHalfWidth(s.trim());

  // 和暦（Rn.M.D 形式）→ 西暦に変換（R1=2019年）
  const reiwaMatch = str.match(/^[Rr令和](\d{1,2})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})日?$/);
  if (reiwaMatch) {
    const [, y, m, d] = reiwaMatch.map(Number);
    return new Date(2018 + y, m - 1, d);
  }

  // 区切り文字を統一
  str = str
    .replace(/年/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, "")
    .replace(/\//g, "-")
    .replace(/\./g, "-")
    .trim();

  const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(y, m - 1, d);
}

export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json();
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      dateParseErrors: [] as string[],
    };

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
        project = await prisma.project.update({
          where: { id: project.id },
          data: { client },
        });
      }

      const spansNum = spans ? parseInt(toHalfWidth(spans)) : null;
      const inspectionDateVal = parseDate(inspectionDate);

      // 日付が入力されているのに解析失敗した場合は警告
      if (inspectionDate && inspectionDate.trim() !== "" && inspectionDateVal === null) {
        results.dateParseErrors.push(
          `「${bridgeName}」の点検完了日「${inspectionDate}」を認識できませんでした（YYYY/MM/DD形式で入力してください）`
        );
      }

      // 既存橋梁を探す
      const existing = await prisma.bridge.findFirst({
        where: { projectId: project.id, name: bridgeName },
      });

      if (existing) {
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
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "インポート失敗" }, { status: 500 });
  }
}
