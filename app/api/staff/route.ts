import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const staff = await prisma.staff.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, type, color } = await req.json();
    if (!name) return NextResponse.json({ error: "氏名は必須です" }, { status: 400 });
    const staff = await prisma.staff.create({
      data: { name, type: type ?? "EMPLOYEE", color: color ?? "#378ADD" },
    });
    return NextResponse.json(staff, { status: 201 });
  } catch {
    return NextResponse.json({ error: "追加失敗" }, { status: 500 });
  }
}
