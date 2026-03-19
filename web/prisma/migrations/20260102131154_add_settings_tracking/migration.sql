-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "lastSettingsChangeDate" TIMESTAMP(3),
ADD COLUMN     "todaySettingsChangeCount" INTEGER NOT NULL DEFAULT 0;
