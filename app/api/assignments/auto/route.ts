import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// "YYYY-MM-DD" 文字列を返す（ローカル時刻基準・タイムゾーンズレなし）
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// "YYYY-MM-DD" 文字列を Date（ローカル時刻の00:00）に変換
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 日付に日数を加算
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// 週パターンのキー（0=日〜6=土）
const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// 担当者の「日付 → 残り勤務時間」マップを生成
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

  // validFrom 昇順にソートしておく
  const sortedShifts = [...shifts].sort(
    (a, b) => a.validFrom.getTime() - b.validFrom.getTime()
  );

  while (cur <= to) {
    const dateStr = toLocalDateStr(cur);
    const dow = cur.getDay();
    const dowKey = DOW_KEYS[dow];

    // 当日に有効なシフト（validFrom <= cur <= validTo）を探す
    // 見つからない場合は「最も近い（最初の）シフト」にフォールバック
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
      // シフト未設定: デフォルト平日8時間
      if (dow >= 1 && dow <= 5) map.set(dateStr, 8);
    }

    cur.setDate(cur.getDate() + 1);
  }

  return map;
}

// POST /api/assignments/auto
export async function POST(req: NextRequest) {
  try {
    const { fiscalYear, projectId, inspectionDates } = await req.json();
    const year = parseInt(fiscalYear);

    const fyStart = new Date(year, 3, 1);       // 4月1日（ローカル）
    const fyEnd = new Date(year + 1, 2, 31, 23, 59, 59); // 翌年3月31日

    // システム設定取得
    const coefSetting = await prisma.systemSettings.findUnique({
      where: { key: "default_span_coefficient" },
    });
    const defaultCoef = coefSetting ? parseFloat(coefSetting.value) : 0.5;

    // 橋梁取得
    const bridgeWhere = projectId ? { projectId: parseInt(projectId) } : {};
    const allBridges = await prisma.bridge.findMany({
      where: bridgeWhere,
      include: { project: true },
    });

    // 担当者取得（業務に設定がなければ全担当者にフォールバック）
    let staffList;
    let usedAllStaff = false;
    if (projectId) {
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
      return NextResponse.json(
        { error: "担当者が1人も登録されていません。マスタ管理から担当者を追加してください。" },
        { status: 400 }
      );
    }

    // 点検完了日マップ
    const doneMap = new Map<number, string>();
    if (Array.isArray(inspectionDates)) {
      for (const { bridgeId, inspectionDoneDate } of inspectionDates) {
        if (inspectionDoneDate) doneMap.set(parseInt(bridgeId), inspectionDoneDate);
      }
    }

    // 橋梁ごとの必要時間・開始可能日を計算（点検完了日なし → スキップ）
    const skippedBridges: Array<{ id: number; name: string; reason: string }> = [];
    const unassignedBridges: Array<{ id: number; name: string; reason: string }> = [];

    const bridgeReqs = allBridges
      .map((b) => {
        const coef = b.spanCoefficient ?? defaultCoef;
        // マスタ登録の径間数(spans)を優先、なければ係数設定のspanCountを使用
        const spanCount = b.spans ?? b.spanCount ?? 1;
        const requiredHours = spanCount * coef * 8;
        const doneDateStr = doneMap.get(b.id);
        if (!doneDateStr) {
          skippedBridges.push({ id: b.id, name: b.name, reason: "点検完了日未入力" });
          return null;
        }
        const doneDate = parseLocalDate(doneDateStr);
        const availableFrom = addDays(doneDate, 8);
        return { bridge: b, requiredHours, availableFrom, inspectionDoneDate: doneDate };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.requiredHours > 0)
      .sort((a, b) => a.availableFrom.getTime() - b.availableFrom.getTime());

    // 担当者ごとの「日付 → 残り時間」マップ（時間単位で管理）
    const staffWorkMaps = staffList.map((s) => ({
      staff: s,
      remainingMap: new Map(buildWorkMap(s.shifts, fyStart, fyEnd)), // 日付 → 残り時間
    }));

    const newAssignments: Array<{
      bridgeId: number;
      staffId: number;
      fiscalYear: number;
      inspectionDoneDate: Date | null;
      startDate: Date;
      endDate: Date;
      isManual: boolean;
    }> = [];

    let staffIndex = 0;

    for (const br of bridgeReqs) {
      let assigned = false;

      for (let attempt = 0; attempt < staffWorkMaps.length; attempt++) {
        const idx = (staffIndex + attempt) % staffWorkMaps.length;
        const sw = staffWorkMaps[idx];

        // availableFrom 以降の日付で残り時間がある日を抽出
        const sortedDates = [...sw.remainingMap.keys()]
          .filter((d) => parseLocalDate(d) >= br.availableFrom && sw.remainingMap.get(d)! > 0)
          .sort();

        // 必要時間を満たせるか確認
        const totalAvail = sortedDates.reduce((s, d) => s + sw.remainingMap.get(d)!, 0);
        if (totalAvail < br.requiredHours) continue; // この担当者では足りない

        // 必要時間分の日付を消費
        let accumulated = 0;
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        const consumed: Array<{ date: string; hours: number }> = [];

        for (const dateStr of sortedDates) {
          const avail = sw.remainingMap.get(dateStr)!;
          const needed = br.requiredHours - accumulated;
          const use = Math.min(avail, needed);

          if (!startDate) startDate = parseLocalDate(dateStr);
          accumulated += use;
          consumed.push({ date: dateStr, hours: use });

          if (accumulated >= br.requiredHours) {
            endDate = parseLocalDate(dateStr);
            break;
          }
        }

        if (startDate && endDate) {
          // 消費分を差し引く
          for (const { date, hours } of consumed) {
            const rem = sw.remainingMap.get(date)! - hours;
            if (rem <= 0) {
              sw.remainingMap.delete(date);
            } else {
              sw.remainingMap.set(date, rem);
            }
          }

          newAssignments.push({
            bridgeId: br.bridge.id,
            staffId: sw.staff.id,
            fiscalYear: year,
            inspectionDoneDate: br.inspectionDoneDate,
            startDate,
            endDate,
            isManual: false,
          });

          staffIndex = (idx + 1) % staffWorkMaps.length;
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        const availStr = toLocalDateStr(br.availableFrom);
        unassignedBridges.push({
          id: br.bridge.id,
          name: br.bridge.name,
          reason: `${availStr}以降に担当者の空き時間が不足（必要：${br.requiredHours.toFixed(0)}時間）`,
        });
      }
    }

    // 「調書作成」工程種別を取得
    const choshoProcessType = await prisma.processType.findFirst({
      where: { name: "調書作成" },
    });

    // 既存の割り当てをすべて削除（手動修正済み含む）
    const deleteWhere = projectId
      ? { fiscalYear: year, bridge: { projectId: parseInt(projectId) } }
      : { fiscalYear: year };
    await prisma.bridgeAssignment.deleteMany({ where: deleteWhere });

    if (newAssignments.length > 0) {
      await prisma.bridgeAssignment.createMany({ data: newAssignments });
    }

    // 「調書作成」工程レコードを自動生成・更新
    if (choshoProcessType) {
      for (const a of newAssignments) {
        // 同一橋梁・同一工程種別（iteration=1）のレコードがあれば更新、なければ作成
        const existing = await prisma.processRecord.findFirst({
          where: { bridgeId: a.bridgeId, processTypeId: choshoProcessType.id, iteration: 1 },
        });
        if (existing) {
          await prisma.processRecord.update({
            where: { id: existing.id },
            data: {
              staffId: a.staffId,
              startDate: a.startDate,
              endDate: a.endDate,
              status: "NOT_STARTED",
            },
          });
        } else {
          await prisma.processRecord.create({
            data: {
              bridgeId: a.bridgeId,
              processTypeId: choshoProcessType.id,
              staffId: a.staffId,
              startDate: a.startDate,
              endDate: a.endDate,
              status: "NOT_STARTED",
              iteration: 1,
            },
          });
        }
      }
    }

    const resultWhere = projectId
      ? { fiscalYear: year, bridge: { projectId: parseInt(projectId) } }
      : { fiscalYear: year };
    const result = await prisma.bridgeAssignment.findMany({
      where: resultWhere,
      include: { bridge: { include: { project: true } }, staff: true },
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
