-- CreateEnum
CREATE TYPE "RecommendationMode" AS ENUM ('AI_MIXED', 'PER_PLATFORM');

-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "recommendationMode" "RecommendationMode" NOT NULL DEFAULT 'AI_MIXED';
