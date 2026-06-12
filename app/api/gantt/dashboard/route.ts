import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compareSerialNo } from "@/lib/utils";

// GET /api/gantt/dashboard?month=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const monthStr = req.nextUrl.searchParams.get("month");
    if (!monthStr) return NextResponse.json({ error: "月を指定してください" }, { status: 400 });

    const [year, month] = monthStr.split("-").map(Number);

    const projects = await prisma.project.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      include: {
        processes: {
          include: { processType: true, staff: true, staffMembers: { include: { staff: true } } },
          orderBy: [{ processType: { order: "asc" } }, { iteration: "asc" }],
        },
        bridges: {
          include: {
            processes: {
              include: { processType: true, staff: true, staffMembers: { include: { staff: true } } },
              orderBy: [{ processType: { order: "asc" } }, { iteration: "asc" }],
            },
            // 自動割り振り結果も含める
            assignments: {
              include: { staff: true, processType: true },
            },
            // 工程別必要時間設定
            processConfigs: true,
          },
        },
      },
    });

    // 橋梁をナチュラルソート（整理番号を数値として比較）
    projects.forEach((p) => {
      p.bridges.sort((a, b) => compareSerialNo(a.serialNo, b.serialNo));
    });

    return NextResponse.json(projects);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}
