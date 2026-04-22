-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "apiTokenEnc" TEXT,
ADD COLUMN     "authMode" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "passwordEnc" TEXT,
ADD COLUMN     "usernameEnc" TEXT;
