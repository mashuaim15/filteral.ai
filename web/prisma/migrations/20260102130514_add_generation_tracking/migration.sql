-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "lastGeneratedDate" TIMESTAMP(3),
ADD COLUMN     "todayGenerationCount" INTEGER NOT NULL DEFAULT 0;
