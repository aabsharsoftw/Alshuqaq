-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'AR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferredLanguage" "Language" NOT NULL DEFAULT 'EN';
