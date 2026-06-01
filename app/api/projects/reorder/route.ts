import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/projects/reorder
// body: { orders: Array<{ id: number; displayOrder: number }> }
export async function PUT(req: NextRequest) {
  try {
    const { orders } = await req.json();
    if (!Array.isArray(orders)) {
      return NextResponse.json({ error: "ordersが不正です" }, { status: 400 });
    }
    await Promise.all(
      orders.map(({ id, displayOrder }: { id: number; displayOrder: number }) =>
        prisma.project.update({
          where: { id },
          data: { displayOrder },
        })
      )
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "並び順の更新に失敗しました" }, { status: 500 });
  }
}
