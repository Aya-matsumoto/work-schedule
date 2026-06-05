import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function buildWorkMap(
  shifts: Array<{
    defaultHoursPerDay: number;
    weekPattern: unknown;
    validFrom: Date;
    validTo: Date | null;
    overrides: Array<{ date: Date; hoursPerDay: number }>;
  }>,
  from: Date,
  to: Date
): Map<string, number> {
  const map = new Map<string, number>();
  const cur = new Date(from);
  const sortedShifts = [...shifts].sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  while (cur <= to) {
    const dateStr = toLocalDateStr(cur);
    const dow = cur.getDay();
    const dowKey = DOW_KEYS[dow];

    const exactShift = sortedShifts.find(
      (s) => s.validFrom <= cur && (s.validTo === null || s.validTo >= cur)
    );
    const shift = exactShift ?? sortedShifts[0] ?? null;

    if (shift) {
      const pattern = shift.weekPattern as Record<string, boolean>;
      if (pattern[dowKey]) {
        const override = shift.overrides.find(
          (o) => toLocalDateStr(new Date(o.date)) === dateStr
        );
        const hours = override != null ? override.hoursPerDay : shift.defaultHoursPerDay;
        if (hours > 0) map.set(dateStr, hours);
      }
    } else {
      if (dow >= 1 && dow <= 5) map.set(dateStr, 8);
    }

    cur.setDate(cur.getDate() + 1);
  }

  return map;
}

// 割り振りロジック: 指定スタッフから availableFrom 以降の空きを探してスケジュールを確定
function assignToStaff(
  staffWorkMaps: Array<{ staff: any; remainingMap: Map<string, number> }>,
  requiredHours: number,
  availableFrom: Date,
  startStaffIndex: number
): { staffIdx: number; startDate: Date; endDate: Date; consumed: Array<{ date: string; hours: number }> } | null {
  for (let attempt = 0; attempt < staffWorkMaps.length; attempt++) {
    const idx = (startStaffIndex + attempt) % staffWorkMaps.length;
    const sw = staffWorkMaps[idx];

    const sortedDates = Array.from(sw.remainingMap.keys())
      .filter((d) => parseLocalDate(d) >= availableFrom && sw.remainingMap.get(d)! > 0)
      .sort();

    const totalAvail = sortedDates.reduce((s, d) => s + sw.remainingMap.get(d)!, 0);
    if (totalAvail < requiredHours) continue;

    let accumulated = 0;
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    const consumed: Array<{ date: string; hours: number }> = [];

    for (const dateStr of sortedDates) {
      const avail = sw.remainingMap.get(dateStr)!;
      const needed = requiredHours - accumulated;
      const use = Math.min(avail, needed);

      if (!startDate) startDate = parseLocalDate(dateStr);
      accumulated += use;
      consumed.push({ date: dateStr, hours: use });

      if (accumulated >= requiredHours) {
        endDate = parseLocalDate(dateStr);
        break;
      }
    }

    if (startDate && endDate) {
      return { staffIdx: idx, startDate, endDate, consumed };
    }
  }
  return null;
}

// POST /api/assignments/auto
export async function POST(req: NextRequest) {
  try {
    const {
      fiscalYear,
      projectId,
      inspectionDates,
      daysAfterInspection,
      targetProcessTypeNames = ["調書作成"],
      staffByProcessType = [],
    } = await req.json();

    // 工程ごとの担当者マップ
    const staffByPtMap = new Map<string, number[]>();
    for (const { processTypeName, staffIds } of staffByProcessType) {
      if (Array.isArray(staffIds) && staffIds.length > 0) {
        staffByPtMap.set(processTypeName, staffIds);
      }
    }

    const year = parseInt(fiscalYear);
    const daysOffset: number =
      typeof daysAfterInspection === "number" && daysAfterInspection >= 0
        ? daysAfterInspection
        : 7;

    const fyStart = new Date(year, 3, 1);
    const fyEnd = new Date(year + 1, 2, 31, 23, 59, 59);

    const coefSetting = await prisma.systemSettings.findUnique({
      where: { key: "default_span_coefficient" },
    });
    const defaultCoef = coefSetting ? parseFloat(coefSetting.value) : 4;

    // 対象工程種別を取得（順序で並べる）
    const targetProcessTypes = await prisma.processType.findMany({
      where: { name: { in: targetProcessTypeNames } },
      orderBy: { order: "asc" },
    });

    if (targetProcessTypes.length === 0) {
      return NextResponse.json({ error: "対象工程種別が見つかりません" }, { status: 400 });
    }

    // 橋梁取得
    const bridgeWhere = projectId ? { projectId: parseInt(projectId) } : {};
    const allBridges = await prisma.bridge.findMany({
      where: bridgeWhere,
      include: { project: true },
    });

    // BridgeProcessConfig を別途取得（include より確実）
    const bridgeIds = allBridges.map((b) => b.id);
    const allProcessConfigs = await prisma.bridgeProcessConfig.findMany({
      where: { bridgeId: { in: bridgeIds } },
    });
    // bridgeId-processTypeId → config のマップ
    const configMap = new Map<string, typeof allProcessConfigs[0]>();
    for (const cfg of allProcessConfigs) {
      configMap.set(`${cfg.bridgeId}-${cfg.processTypeId}`, cfg);
    }

    // 担当者取得（工程別指定がある場合は全対象IDを合算してロード）
    let staffList;
    let usedAllStaff = false;
    if (staffByPtMap.size > 0) {
      const allIds = [...new Set([...staffByPtMap.values()].flat())];
      staffList = await prisma.staff.findMany({
        where: { id: { in: allIds } },
        include: { shifts: { include: { overrides: true } } },
        orderBy: { id: "asc" },
      });
    } else if (projectId) {
      const projectStaff = await prisma.projectStaff.findMany({
        where: { projectId: parseInt(projectId) },
        include: { staff: { include: { shifts: { include: { overrides: true } } } } },
        orderBy: { priority: "asc" },
      });
      if (projectStaff.length > 0) {
        staffList = projectStaff.map((ps) => ps.staff);
      } else {
        usedAllStaff = true;
        staffList = await prisma.staff.findMany({
          include: { shifts: { include: { overrides: true } } },
          orderBy: { id: "asc" },
        });
      }
    } else {
      staffList = await prisma.staff.findMany({
        include: { shifts: { include: { overrides: true } } },
        orderBy: { id: "asc" },
      });
    }

    if (staffList.length === 0) {
      return NextResponse.json({ error: "担当者が1人も登録されていません。" }, { status: 400 });
    }

    // 点検完了日マップ
    const doneMap = new Map<number, string>();
    if (Array.isArray(inspectionDates)) {
      for (const { bridgeId, inspectionDoneDate } of inspectionDates) {
        if (inspectionDoneDate) doneMap.set(parseInt(bridgeId), inspectionDoneDate);
      }
    }

    // 担当者ごとの稼働マップ
    const staffWorkMaps = staffList.map((s) => ({
      staff: s,
      remainingMap: new Map(buildWorkMap(s.shifts, fyStart, fyEnd)),
    }));

    // 業務・年度の割り振りをすべて削除（processTypeId は問わない）
    const deleteWhere = projectId
      ? { fiscalYear: year, bridge: { projectId: parseInt(projectId) } }
      : { fiscalYear: year };
    await prisma.bridgeAssignment.deleteMany({ where: deleteWhere });

    const newAssignments: Array<{
      bridgeId: number;
      staffId: number;
      processTypeId: number;
      fiscalYear: number;
      inspectionDoneDate: Date | null;
      startDate: Date;
      endDate: Date;
      isManual: boolean;
    }> = [];

    const skippedBridges: Array<{ id: number; name: string; reason: string }> = [];
    const unassignedBridges: Array<{ id: number; name: string; reason: string }> = [];

    // 最初の工程（調書作成）は点検完了日が必要な順でソート
    const firstPt = targetProcessTypes[0];
    const firstPtBridges = allBridges
      .filter((b) => doneMap.has(b.id))
      .sort((a, b) => {
        const da = parseLocalDate(doneMap.get(a.id)!).getTime();
        const db = parseLocalDate(doneMap.get(b.id)!).getTime();
        return da - db;
      });

    // 点検完了日なし → スキップ
    for (const b of allBridges) {
      if (!doneMap.has(b.id)) {
        skippedBridges.push({ id: b.id, name: b.name, reason: "点検完了日未入力" });
      }
    }

    let staffIndex = 0;

    // ── 橋梁ごとに工程を順番に割り振る ──
    for (const bridge of firstPtBridges) {
      const doneDateStr = doneMap.get(bridge.id)!;
      const doneDate = parseLocalDate(doneDateStr);

      // 前工程の終了日を追跡
      const prevEndDateMap = new Map<string, Date>(); // processTypeName -> endDate

      for (const pt of targetProcessTypes) {
        // 必要時間を決定（BridgeProcessConfig を優先）
        const config = configMap.get(`${bridge.id}-${pt.id}`);
        let requiredHours: number;
        if (config?.requiredHours != null) {
          requiredHours = Number(config.requiredHours);
        } else {
          const sc = config?.spanCount ?? bridge.spans ?? bridge.spanCount ?? 1;
          const coef = config?.spanCoefficient ?? bridge.spanCoefficient ?? defaultCoef;
          requiredHours = Number(sc) * Number(coef);
        }
        if (requiredHours <= 0) continue;

        // 開始可能日を決定
        let availableFrom: Date;
        const ptOrder = targetProcessTypes.findIndex((x) => x.id === pt.id);
        if (ptOrder === 0) {
          // 最初の工程（調書作成）は点検完了日 + daysOffset
          availableFrom = addDays(doneDate, daysOffset);
        } else {
          // 後続工程は前工程の終了日の翌日
          const prevPt = targetProcessTypes[ptOrder - 1];
          const prevEnd = prevEndDateMap.get(prevPt.name);
          if (!prevEnd) {
            // 前工程が割り振れなかった → この工程もスキップ
            unassignedBridges.push({
              id: bridge.id,
              name: `${bridge.name}（${pt.name}）`,
              reason: `前工程「${prevPt.name}」が未割り当てのためスキップ`,
            });
            continue;
          }
          availableFrom = addDays(prevEnd, 1);
        }

        // 工程専用担当者フィルタ（指定なしなら全員）
        const ptStaffIds = staffByPtMap.get(pt.name);
        const targetMaps = ptStaffIds
          ? staffWorkMaps.filter((sw) => ptStaffIds.includes(sw.staff.id))
          : staffWorkMaps;

        // 空きスロットを探して割り振る
        const result = assignToStaff(targetMaps, requiredHours, availableFrom, staffIndex % Math.max(targetMaps.length, 1));
        if (!result) {
          unassignedBridges.push({
            id: bridge.id,
            name: `${bridge.name}（${pt.name}）`,
            reason: `${toLocalDateStr(availableFrom)}以降に空き不足（必要：${requiredHours.toFixed(0)}時間）`,
          });
          continue;
        }

        // 稼働マップから消費（targetMaps のインデックスを使う）
        const assignedSw = targetMaps[result.staffIdx];
        for (const { date, hours } of result.consumed) {
          const rem = (assignedSw.remainingMap.get(date) ?? 0) - hours;
          if (rem <= 0) assignedSw.remainingMap.delete(date);
          else assignedSw.remainingMap.set(date, rem);
        }

        newAssignments.push({
          bridgeId: bridge.id,
          staffId: assignedSw.staff.id,
          processTypeId: pt.id,
          fiscalYear: year,
          inspectionDoneDate: doneDate,
          startDate: result.startDate,
          endDate: result.endDate,
          isManual: false,
        });

        prevEndDateMap.set(pt.name, result.endDate);
        staffIndex = (result.staffIdx + 1) % Math.max(targetMaps.length, 1);
      }
    }

    if (newAssignments.length > 0) {
      await prisma.bridgeAssignment.createMany({ data: newAssignments });
    }

    // ProcessRecord を工程種別ごとに作成・更新
    for (const a of newAssignments) {
      const existing = await prisma.processRecord.findFirst({
        where: { bridgeId: a.bridgeId, processTypeId: a.processTypeId, iteration: 1 },
      });
      if (existing) {
        await prisma.processRecord.update({
          where: { id: existing.id },
          data: { staffId: a.staffId, startDate: a.startDate, endDate: a.endDate, status: "NOT_STARTED" },
        });
        await prisma.processRecordStaff.deleteMany({ where: { processRecordId: existing.id } });
        await prisma.processRecordStaff.create({ data: { processRecordId: existing.id, staffId: a.staffId } });
      } else {
        const created = await prisma.processRecord.create({
          data: {
            bridgeId: a.bridgeId,
            processTypeId: a.processTypeId,
            staffId: a.staffId,
            startDate: a.startDate,
            endDate: a.endDate,
            status: "NOT_STARTED",
            iteration: 1,
          },
        });
        await prisma.processRecordStaff.create({ data: { processRecordId: created.id, staffId: a.staffId } });
      }
    }

    const resultWhere = projectId
      ? { fiscalYear: year, bridge: { projectId: parseInt(projectId) }, processTypeId: { in: targetProcessTypes.map((pt) => pt.id) } }
      : { fiscalYear: year, processTypeId: { in: targetProcessTypes.map((pt) => pt.id) } };
    const result = await prisma.bridgeAssignment.findMany({
      where: resultWhere,
      include: { bridge: { include: { project: true } }, staff: true, processType: true },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({
      assigned: result.length,
      skipped: skippedBridges.length,
      skippedBridges,
      unassigned: unassignedBridges.length,
      unassignedBridges,
      usedAllStaff,
      staffCount: staffList.length,
      assignments: result,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "自動割り振り失敗" }, { status: 500 });
  }
}
