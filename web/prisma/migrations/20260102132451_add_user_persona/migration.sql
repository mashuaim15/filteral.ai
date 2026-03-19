-- CreateTable
CREATE TABLE "UserPersona" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" VARCHAR(500),
    "interests" VARCHAR(500),
    "profession" VARCHAR(100),
    "expertise" VARCHAR(200),
    "contentPref" VARCHAR(300),
    "lastUserInput" TEXT,
    "lastInputDate" TIMESTAMP(3),
    "todayInputCount" INTEGER NOT NULL DEFAULT 0,
    "compiledPersona" VARCHAR(1000),
    "lastCompiledAt" TIMESTAMP(3),
    "viewingSignals" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPersona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPersona_userId_key" ON "UserPersona"("userId");

-- AddForeignKey
ALTER TABLE "UserPersona" ADD CONSTRAINT "UserPersona_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
