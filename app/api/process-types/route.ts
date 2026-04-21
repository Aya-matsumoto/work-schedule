import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const types = await prisma.processType.findMany({ orderBy: { order: "asc" } });
    return NextResponse.json(types);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, color } = await req.json();
    if (!name) return NextResponse.json({ error: "工程名は必須です" }, { status: 400 });
    const last = await prisma.processType.findFirst({ orderBy: { order: "desc" } });
    const pt = await prisma.processType.create({
      data: { name, color: color ?? "#378ADD", order: (last?.order ?? 0) + 1 },
    });
    return NextResponse.json(pt, { status: 201 });
  } catch {
    return NextResponse.json({ error: "追加失敗" }, { status: 500 });
  }
}
