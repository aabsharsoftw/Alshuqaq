import { Injectable, NotFoundException } from '@nestjs/common';
import { Language, ListingStatus, Prisma, Role, User } from '@prisma/client';
import { Lang, localizeMany, toLanguageEnum } from '../common/i18n/localize';
import { PrismaService } from '../prisma/prisma.service';

const savedListingInclude = {
  images: { orderBy: { createdAt: 'asc' as const } },
  landlord: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.ListingInclude;

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  landlordApproved: true,
  preferredLanguage: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findLandlords() {
    return this.prisma.user.findMany({
      where: { role: Role.LANDLORD },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        landlordApproved: true,
        createdAt: true,
        _count: { select: { listings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  setLandlordApproved(id: string, approved: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { landlordApproved: approved },
      select: publicUserSelect,
    });
  }

  setPreferredLanguage(id: string, lang: Lang) {
    return this.prisma.user.update({
      where: { id },
      data: { preferredLanguage: toLanguageEnum(lang) as Language },
      select: publicUserSelect,
    });
  }

  /** The current user's saved listings, newest first, localized. */
  async findSavedListings(userId: string, lang: Lang) {
    const saved = await this.prisma.savedListing.findMany({
      where: { userId },
      include: { listing: { include: savedListingInclude } },
      orderBy: { createdAt: 'desc' },
    });
    return localizeMany(
      saved.map((s) => s.listing),
      lang,
    );
  }

  /** Save a listing for the user. Idempotent: re-saving is a no-op. */
  async saveListing(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, status: ListingStatus.APPROVED },
      select: { id: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found.');
    }
    await this.prisma.savedListing.upsert({
      where: { userId_listingId: { userId, listingId } },
      update: {},
      create: { userId, listingId },
    });
    return { success: true };
  }

  /** Remove a listing from the user's saved list. Idempotent. */
  async unsaveListing(userId: string, listingId: string) {
    await this.prisma.savedListing.deleteMany({ where: { userId, listingId } });
    return { success: true };
  }
}
