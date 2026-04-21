import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/gantt/dashboard?month=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const monthStr = req.nextUrl.searchParams.get("month");
    if (!monthStr) return NextResponse.json({ error: "月を指定してください" }, { status: 400 });

    const [year, month] = monthStr.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        bridges: {
          orderBy: { serialNo: "asc" },
          include: {
            processes: {
              include: { processType: true, staff: true },
              orderBy: [{ processType: { order: "asc" } }, { iteration: "asc" }],
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
