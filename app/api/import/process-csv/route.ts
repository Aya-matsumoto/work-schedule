import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s || s.trim() === "") return null;
  let str = toHalfWidth(s.trim())
    .replace(/年/g, "-").replace(/月/g, "-").replace(/日/g, "")
    .replace(/\//g, "-").replace(/\./g, "-").trim();
  const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(y, m - 1, d);
}

function parseStatus(s: string): string {
  if (s === "完了") return "COMPLETED";
  if (s === "作業中") return "IN_PROGRESS";
  return "NOT_STARTED";
}

// 工程名の末尾の丸数字（②③…）を反復番号として分離
// 例：「修正②」→ { base: "修正", iteration: 2 }、「調書作成」→ { base, iteration: 1 }
function parseIteration(raw: string): { base: string; iteration: number } {
  const m = raw.match(/^(.*?)([①-⑳])$/);
  if (m) return { base: m[1], iteration: m[2].charCodeAt(0) - 0x2460 + 1 };
  return { base: raw, iteration: 1 };
}

// POST /api/import/process-csv
export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json();

    const results = {
      updated: 0,
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // 全工程種別を取得
    const allPts = await prisma.processType.findMany();
    const ptMap = new Map<string, number>(); // name → id
    for (const pt of allPts) ptMap.set(pt.name, pt.id);

    // 全担当者を取得
    const allStaff = await prisma.staff.findMany();
    const staffMap = new Map<string, number>(); // name → id
    for (const s of allStaff) staffMap.set(s.name, s.id);

    for (const row of rows) {
      const { projectName, bridgeName } = row;
      if (!projectName || !bridgeName) {
        results.skipped++;
        results.errors.push("業務名・橋梁名が空の行をスキップしました");
        continue;
      }

      // 業務を検索
      const project = await prisma.project.findFirst({ where: { name: projectName } });
      if (!project) {
        results.skipped++;
        results.errors.push(`業務「${projectName}」が見つかりません。先に業務・橋梁を登録してください。`);
        continue;
      }

      // 橋梁を検索
      const bridge = await prisma.bridge.findFirst({
        where: { projectId: project.id, name: bridgeName },
      });
      if (!bridge) {
        results.skipped++;
        results.errors.push(`橋梁「${bridgeName}」（業務：${projectName}）が見つかりません。`);
        continue;
      }

      // 行から工程列（_担当者 / _開始日 / _終了日 / _ステータス）を検出
      const ptNames = new Set<string>();
      for (const key of Object.keys(row)) {
        for (const suffix of ["_担当者", "_開始日", "_終了日", "_ステータス"]) {
          if ((key as string).endsWith(suffix)) {
            ptNames.add((key as string).slice(0, -(suffix.length)));
          }
        }
      }

      for (const ptName of ptNames) {
        const { base, iteration } = parseIteration(ptName);
        const ptId = ptMap.get(base);
        if (!ptId) continue;

        const staffRaw: string = row[`${ptName}_担当者`] ?? "";
        const startRaw: string = row[`${ptName}_開始日`] ?? "";
        const endRaw: string = row[`${ptName}_終了日`] ?? "";
        const statusRaw: string = row[`${ptName}_ステータス`] ?? "";

        // 担当者が空で日付も空ならスキップ
        if (!staffRaw && !startRaw && !endRaw) continue;

        const startDate = parseDate(startRaw);
        const endDate = parseDate(endRaw);
        const status = parseStatus(statusRaw);

        // 担当者名を分解（「・」区切り）
        const staffNames = staffRaw
          ? staffRaw.split(/[・,、]/).map((n) => n.trim()).filter(Boolean)
          : [];
        const staffIds = staffNames
          .map((n) => staffMap.get(n))
          .filter((id): id is number => id !== undefined);

        const primaryStaffId = staffIds[0] ?? null;

        // 既存の ProcessRecord（同一反復番号）を探す
        const existing = await prisma.processRecord.findFirst({
          where: { bridgeId: bridge.id, processTypeId: ptId, iteration },
        });

        if (existing) {
          // 更新
          await prisma.processRecord.update({
            where: { id: existing.id },
            data: {
              staffId: primaryStaffId ?? existing.staffId,
              startDate: startDate ?? existing.startDate,
              endDate: endDate ?? existing.endDate,
              status,
              ...(status === "COMPLETED" && !existing.completedDate && endDate
                ? { completedDate: endDate }
                : {}),
            },
          });
          // ProcessRecordStaff を作り直す
          if (staffIds.length > 0) {
            await prisma.processRecordStaff.deleteMany({ where: { processRecordId: existing.id } });
            await prisma.processRecordStaff.createMany({
              data: staffIds.map((sid) => ({ processRecordId: existing.id, staffId: sid })),
              skipDuplicates: true,
            });
          }
          results.updated++;
        } else {
          // 新規作成
          const created = await prisma.processRecord.create({
            data: {
              bridgeId: bridge.id,
              projectId: null,
              processTypeId: ptId,
              staffId: primaryStaffId,
              startDate,
              endDate,
              status,
              completedDate: status === "COMPLETED" ? endDate : null,
              iteration,
            },
          });
          if (staffIds.length > 0) {
            await prisma.processRecordStaff.createMany({
              data: staffIds.map((sid) => ({ processRecordId: created.id, staffId: sid })),
              skipDuplicates: true,
            });
          }
          results.created++;
        }
      }
    }

    return NextResponse.json(results);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "インポート失敗" }, { status: 500 });
  }
}
