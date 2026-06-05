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

    const processWhereClause = {
      OR: [
        { startDate: { gte: monthStart, lte: monthEnd } },
        { endDate: { gte: monthStart, lte: monthEnd } },
        { startDate: { lte: monthStart }, endDate: { gte: monthEnd } },
      ],
    };

    const processInclude = {
      processType: true,
      bridge: { include: { project: true } },
      project: true,
      staffMembers: { include: { staff: true } },
    };

    const staff = await prisma.staff.findMany({
      orderBy: { id: "asc" },
      include: {
        // staffId FK 経由の工程
        processes: {
          where: processWhereClause,
          include: processInclude,
        },
        // junction table 経由の工程（複数担当者の2人目以降）
        processRecords: {
          where: {
            processRecord: processWhereClause,
          },
          include: {
            processRecord: {
              include: processInclude,
            },
          },
        },
        // 自動割り振り結果
        assignments: {
          where: {
            OR: [
              { startDate: { gte: monthStart, lte: monthEnd } },
              { endDate: { gte: monthStart, lte: monthEnd } },
              { startDate: { lte: monthStart }, endDate: { gte: monthEnd } },
            ],
          },
          include: {
            bridge: { include: { project: true } },
            processType: true,
          },
        },
      },
    });

    // processes と processRecords をマージして重複排除
    const result = staff.map((s) => {
      const seen = new Set<number>();
      const merged = [];

      for (const proc of s.processes) {
        seen.add(proc.id);
        merged.push(proc);
      }

      for (const pr of s.processRecords) {
        const proc = pr.processRecord;
        if (!proc) continue;
        if (seen.has(proc.id)) continue;
        seen.add(proc.id);
        merged.push(proc);
      }

      return {
        id: s.id,
        name: s.name,
        color: s.color,
        processes: merged,
        assignments: s.assignments,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}
