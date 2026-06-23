/*
  Warnings:

  - You are about to drop the column `description` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Listing` table. All the data in the column will be lost.
  - Added the required column `descriptionAr` to the `Listing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `descriptionEn` to the `Listing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationAr` to the `Listing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationEn` to the `Listing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titleAr` to the `Listing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titleEn` to the `Listing` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Listing" DROP COLUMN "description",
DROP COLUMN "location",
DROP COLUMN "title",
ADD COLUMN     "descriptionAr" TEXT NOT NULL,
ADD COLUMN     "descriptionEn" TEXT NOT NULL,
ADD COLUMN     "locationAr" TEXT NOT NULL,
ADD COLUMN     "locationEn" TEXT NOT NULL,
ADD COLUMN     "titleAr" TEXT NOT NULL,
ADD COLUMN     "titleEn" TEXT NOT NULL;
