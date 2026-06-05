import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/bridge-process-configs?processTypeId=X
// すべての BridgeProcessConfig を取得（processTypeId でフィルタ可）
export async function GET(req: NextRequest) {
  try {
    const processTypeId = req.nextUrl.searchParams.get("processTypeId");
    const configs = await prisma.bridgeProcessConfig.findMany({
      where: processTypeId ? { processTypeId: parseInt(processTypeId) } : undefined,
      include: { processType: true },
    });
    return NextResponse.json(configs);
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

// PUT /api/bridge-process-configs  (upsert 1件)
// body: { bridgeId, processTypeId, spanCount?, spanCoefficient?, requiredHours? }
export async function PUT(req: NextRequest) {
  try {
    const { bridgeId, processTypeId, spanCount, spanCoefficient, requiredHours } = await req.json();
    const config = await prisma.bridgeProcessConfig.upsert({
      where: { bridgeId_processTypeId: { bridgeId, processTypeId } },
      update: {
        spanCount: spanCount != null ? parseInt(spanCount) : null,
        spanCoefficient: spanCoefficient != null ? parseFloat(spanCoefficient) : null,
        requiredHours: requiredHours != null && requiredHours !== "" ? parseFloat(requiredHours) : null,
      },
      create: {
        bridgeId,
        processTypeId,
        spanCount: spanCount != null ? parseInt(spanCount) : null,
        spanCoefficient: spanCoefficient != null ? parseFloat(spanCoefficient) : null,
        requiredHours: requiredHours != null && requiredHours !== "" ? parseFloat(requiredHours) : null,
      },
    });
    return NextResponse.json(config);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存失敗" }, { status: 500 });
  }
}
