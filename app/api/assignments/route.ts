import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/assignments?year=2025
export async function GET(req: NextRequest) {
  try {
    const year = req.nextUrl.searchParams.get("year");
    const where = year ? { fiscalYear: parseInt(year) } : {};

    const assignments = await prisma.bridgeAssignment.findMany({
      where,
      include: {
        bridge: { include: { project: true } },
        staff: true,
      },
      orderBy: [{ fiscalYear: "desc" }, { startDate: "asc" }],
    });
    return NextResponse.json(assignments);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}
