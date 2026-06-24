import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { Lang, localizeListing, localizeMany } from '../common/i18n/localize';
import { ImageKitService } from '../imagekit/imagekit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

const listingInclude = {
  images: { orderBy: { createdAt: 'asc' as const } },
  landlord: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.ListingInclude;

type ListingWithRelations = Prisma.ListingGetPayload<{
  include: typeof listingInclude;
}>;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imagekit: ImageKitService,
    private readonly mail: MailService,
    private readonly translation: TranslationService,
  ) {}

  /** Landlord creates a listing with images. Trusted landlords skip review. */
  async create(
    landlord: AuthUser,
    dto: CreateListingDto,
    files: Express.Multer.File[],
    lang: Lang,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image is required.');
    }

    const images = await this.imagekit.uploadMany(files);

    const text = await this.translation.toBilingual(
      { title: dto.title, location: dto.location, description: dto.description },
      lang,
    );

    const status = dto.isDraft
      ? ListingStatus.DRAFT
      : landlord.landlordApproved
        ? ListingStatus.APPROVED
        : ListingStatus.PENDING;

    const listing = await this.prisma.listing.create({
      data: {
        ...text,
        rent: dto.rent,
        status,
        landlordId: landlord.id,
        images: {
          create: images.map((img) => ({
            url: img.url,
            thumbnailUrl: img.thumbnailUrl,
            fileId: img.fileId,
          })),
        },
      },
      include: listingInclude,
    });

    if (status === ListingStatus.PENDING) {
      this.mail.sendAdminNewListing(landlord.email, toSummary(listing));
    }

    return localizeListing(listing, lang);
  }

  /** Public feed: only approved listings, paginated, with optional search. */
  async findPublic(
    query: QueryListingsDto,
    lang: Lang,
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit, search } = query;
    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.APPROVED,
      ...(search
        ? {
            // Match the term in either language.
            OR: [
              { titleEn: { contains: search, mode: 'insensitive' } },
              { titleAr: { contains: search, mode: 'insensitive' } },
              { locationEn: { contains: search, mode: 'insensitive' } },
              { locationAr: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        include: listingInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: localizeMany(data, lang),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Public details by UUID or numeric listingNumber; approved only. */
  async findOnePublic(idOrNumber: string, lang: Lang) {
    const where = this.idOrNumberWhere(idOrNumber);
    const listing = await this.prisma.listing.findFirst({
      where: { ...where, status: ListingStatus.APPROVED },
      include: listingInclude,
    });
    if (!listing) {
      throw new NotFoundException('Listing not found.');
    }
    return localizeListing(listing, lang);
  }

  /** A landlord's own listings (any status). */
  async findMine(landlordId: string, lang: Lang) {
    const listings = await this.prisma.listing.findMany({
      where: { landlordId },
      include: listingInclude,
      orderBy: { createdAt: 'desc' },
    });
    return localizeMany(listings, lang);
  }

  async update(id: string, user: AuthUser, dto: UpdateListingDto, lang: Lang) {
    const listing = await this.getOwnedOrAdmin(id, user);

    // Re-translate only the text fields that actually changed, treating the
    // incoming values as written in the request's language (`lang`).
    const data: Prisma.ListingUpdateInput = {};
    if (dto.rent !== undefined) data.rent = dto.rent;
    if (dto.title !== undefined) {
      const { en, ar } = await this.translation.fieldToBilingual(
        dto.title,
        lang,
      );
      data.titleEn = en;
      data.titleAr = ar;
    }
    if (dto.location !== undefined) {
      const { en, ar } = await this.translation.fieldToBilingual(
        dto.location,
        lang,
      );
      data.locationEn = en;
      data.locationAr = ar;
    }
    if (dto.description !== undefined) {
      const { en, ar } = await this.translation.fieldToBilingual(
        dto.description,
        lang,
      );
      data.descriptionEn = en;
      data.descriptionAr = ar;
    }

    if (dto.isDraft === false && listing.status === ListingStatus.DRAFT) {
      data.status = user.landlordApproved
        ? ListingStatus.APPROVED
        : ListingStatus.PENDING;
    }

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data,
      include: listingInclude,
    });
    return localizeListing(updated, lang);
  }

  async remove(id: string, user: AuthUser) {
    const listing = await this.getOwnedOrAdmin(id, user);
    const fileIds = listing.images.map((img) => img.fileId);
    await this.prisma.listing.delete({ where: { id: listing.id } });
    // Cascade removed DB rows; clean up the stored files too.
    await this.imagekit.deleteMany(fileIds);
    return { success: true };
  }

  // ----- Admin-facing helpers -----

  async adminFindAll(
    status: ListingStatus | undefined,
    page = 1,
    limit = 20,
    lang: Lang = 'en',
  ) {
    const where: Prisma.ListingWhereInput = status ? { status } : {};
    const [total, data] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        include: listingInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data: localizeMany(data, lang),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async setStatus(
    id: string,
    status: ListingStatus,
    reason?: string,
    lang: Lang = 'en',
  ) {
    const existing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });
    if (!existing) {
      throw new NotFoundException('Listing not found.');
    }
    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status },
      include: listingInclude,
    });

    this.mail.sendLandlordDecision(
      updated.landlord.email,
      toSummary(updated),
      status === ListingStatus.APPROVED,
      reason,
    );

    return localizeListing(updated, lang);
  }

  // ----- internals -----

  private async getOwnedOrAdmin(id: string, user: AuthUser) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });
    if (!listing) {
      throw new NotFoundException('Listing not found.');
    }
    if (user.role !== Role.ADMIN && listing.landlordId !== user.id) {
      throw new ForbiddenException('You do not own this listing.');
    }
    return listing;
  }

  private idOrNumberWhere(idOrNumber: string): Prisma.ListingWhereInput {
    const asNumber = Number(idOrNumber);
    if (Number.isInteger(asNumber) && String(asNumber) === idOrNumber) {
      return { listingNumber: asNumber };
    }
    return { id: idOrNumber };
  }
}

/**
 * Builds the English summary used in transactional emails. Emails (admin
 * notifications + landlord decisions) are kept in English for operational
 * consistency.
 */
function toSummary(listing: ListingWithRelations) {
  return {
    listingNumber: listing.listingNumber,
    title: listing.titleEn,
    location: listing.locationEn,
    rent: listing.rent,
  };
}
