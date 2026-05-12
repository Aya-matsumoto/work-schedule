import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/gantt/dashboard?month=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const monthStr = req.nextUrl.searchParams.get("month");
    if (!monthStr) return NextResponse.json({ error: "月を指定してください" }, { status: 400 });

    const [year, month] = monthStr.split("-").map(Number);

    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        processes: {
          include: { processType: true, staff: true },
          orderBy: [{ processType: { order: "asc" } }, { iteration: "asc" }],
        },
        bridges: {
          orderBy: { serialNo: "asc" },
          include: {
            processes: {
              include: { processType: true, staff: true },
              orderBy: [{ processType: { order: "asc" } }, { iteration: "asc" }],
            },
            // 自動割り振り結果も含める
            assignments: {
              include: { staff: true },
            },
          },
        },
      },
    });

    return NextResponse.json(projects);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}
