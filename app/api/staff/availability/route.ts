import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/staff/availability?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const dateStr = req.nextUrl.searchParams.get("date");
    if (!dateStr) return NextResponse.json({ error: "日付を指定してください" }, { status: 400 });

    const date = new Date(dateStr);
    const staff = await prisma.staff.findMany({
      orderBy: { id: "asc" },
      include: {
        processes: {
          where: {
            startDate: { lte: date },
            endDate: { gte: date },
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
