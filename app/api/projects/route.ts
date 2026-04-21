import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: { bridges: { include: { processes: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(projects);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, client, fiscalYear, deadline, note } = await req.json();
    if (!name) return NextResponse.json({ error: "業務名は必須です" }, { status: 400 });
    const project = await prisma.project.create({
      data: { name, client, fiscalYear, deadline: deadline ? new Date(deadline) : null, note },
    });
    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json({ error: "作成失敗" }, { status: 500 });
  }
}
