-- Add aiModel, aiApiKey, and followedAccounts to UserPreferences
ALTER TABLE "UserPreferences" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;
ALTER TABLE "UserPreferences" ADD COLUMN IF NOT EXISTS "aiApiKey" TEXT;
ALTER TABLE "UserPreferences" ADD COLUMN IF NOT EXISTS "followedAccounts" TEXT;
