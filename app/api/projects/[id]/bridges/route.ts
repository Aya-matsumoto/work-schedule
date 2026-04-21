import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, serialNo, spans } = await req.json();
    if (!name) return NextResponse.json({ error: "橋梁名は必須です" }, { status: 400 });

    const bridge = await prisma.bridge.create({
      data: {
        projectId: parseInt(params.id),
        name,
        serialNo: serialNo || null,
        spans: spans ? parseInt(spans) : null,
      },
    });
    return NextResponse.json(bridge, { status: 201 });
  } catch {
    return NextResponse.json({ error: "追加失敗" }, { status: 500 });
  }
}
