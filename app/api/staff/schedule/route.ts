import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/staff/schedule?month=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    const monthStr = req.nextUrl.searchParams.get("month");
    if (!monthStr) return NextResponse.json({ error: "月を指定してください" }, { status: 400 });

    const [year, month] = monthStr.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const staff = await prisma.staff.findMany({
      orderBy: { id: "asc" },
      include: {
        processes: {
          where: {
            OR: [
              { startDate: { gte: monthStart, lte: monthEnd } },
              { endDate: { gte: monthStart, lte: monthEnd } },
              { startDate: { lte: monthStart }, endDate: { gte: monthEnd } },
            ],
          },
          include: {
            processType: true,
            bridge: { include: { project: true } },
          },
        },
      },
    });
    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}
