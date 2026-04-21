import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("シードデータを投入中...");

  // 工程種別マスタ（v2）
  const processTypes = [
    { name: "白図作成",    order: 1, color: "#378ADD" },
    { name: "白図チェック",order: 2, color: "#1D9E75" },
    { name: "仕掛品",      order: 3, color: "#EF9F27" },
    { name: "調書作成",    order: 4, color: "#D85A30" },
    { name: "システム貼付",order: 5, color: "#7F77DD" },
    { name: "チェック",    order: 6, color: "#E24B4A" },
    { name: "修正",        order: 7, color: "#BA7517" },
    { name: "提出",        order: 8, color: "#0F6E56" },
  ];

  for (const pt of processTypes) {
    await prisma.processType.upsert({
      where: { id: pt.order },
      update: {},
      create: pt,
    });
  }
  console.log(`工程種別を ${processTypes.length} 件登録しました`);

  // 担当者マスタ
  const staffNames = [
    "吉賀", "鵜野", "高尾", "辻本", "越智", "重吉",
    "松本", "勝部", "原", "小林", "萩原", "房安",
  ];

  for (let i = 0; i < staffNames.length; i++) {
    await prisma.staff.upsert({
      where: { id: i + 1 },
      update: {},
      create: { name: staffNames[i], type: "EMPLOYEE", color: "#378ADD" },
    });
  }
  console.log(`担当者を ${staffNames.length} 名登録しました`);

  console.log("完了！");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
