/*
  Warnings:

  - You are about to drop the column `district` on the `Bridge` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledDate` on the `ProcessRecord` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `ProcessType` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Staff` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bridge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "serialNo" TEXT,
    "spans" INTEGER,
    "inspectionDate" DATETIME,
    "inspectionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bridge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Bridge" ("createdAt", "id", "inspectionDate", "inspectionNote", "name", "projectId", "serialNo", "spans", "updatedAt") SELECT "createdAt", "id", "inspectionDate", "inspectionNote", "name", "projectId", "serialNo", "spans", "updatedAt" FROM "Bridge";
DROP TABLE "Bridge";
ALTER TABLE "new_Bridge" RENAME TO "Bridge";
CREATE TABLE "new_ProcessRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bridgeId" INTEGER NOT NULL,
    "processTypeId" INTEGER NOT NULL,
    "staffId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "completedDate" DATETIME,
    "note" TEXT,
    "iteration" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcessRecord_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "Bridge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessRecord_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "ProcessType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProcessRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProcessRecord" ("bridgeId", "completedDate", "createdAt", "id", "iteration", "note", "processTypeId", "staffId", "status", "updatedAt") SELECT "bridgeId", "completedDate", "createdAt", "id", "iteration", "note", "processTypeId", "staffId", "status", "updatedAt" FROM "ProcessRecord";
DROP TABLE "ProcessRecord";
ALTER TABLE "new_ProcessRecord" RENAME TO "ProcessRecord";
CREATE TABLE "new_ProcessType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#378ADD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ProcessType" ("color", "createdAt", "id", "name", "order", "updatedAt") SELECT "color", "createdAt", "id", "name", "order", "updatedAt" FROM "ProcessType";
DROP TABLE "ProcessType";
ALTER TABLE "new_ProcessType" RENAME TO "ProcessType";
CREATE TABLE "new_Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "fiscalYear" TEXT,
    "deadline" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("createdAt", "deadline", "fiscalYear", "id", "name", "note", "updatedAt") SELECT "createdAt", "deadline", "fiscalYear", "id", "name", "note", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE TABLE "new_Staff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "color" TEXT NOT NULL DEFAULT '#378ADD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Staff" ("color", "createdAt", "id", "name", "type", "updatedAt") SELECT "color", "createdAt", "id", "name", "type", "updatedAt" FROM "Staff";
DROP TABLE "Staff";
ALTER TABLE "new_Staff" RENAME TO "Staff";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
