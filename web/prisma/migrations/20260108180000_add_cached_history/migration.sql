-- Add cached history and channels to SiteConnection
ALTER TABLE "SiteConnection" ADD COLUMN "cachedHistory" TEXT;
ALTER TABLE "SiteConnection" ADD COLUMN "cachedChannels" TEXT;
ALTER TABLE "SiteConnection" ADD COLUMN "cacheUpdatedAt" TIMESTAMP(3);
ALTER TABLE "SiteConnection" ADD COLUMN "needsReauth" BOOLEAN NOT NULL DEFAULT false;
