import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { ImageKitService } from '../imagekit/imagekit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

const listingInclude = {
  images: { orderBy: { createdAt: 'asc' as const } },
  landlord: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.ListingInclude;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imagekit: ImageKitService,
    private readonly mail: MailService,
  ) {}

  /** Landlord creates a listing with images. Trusted landlords skip review. */
  async create(
    landlord: AuthUser,
    dto: CreateListingDto,
    files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image is required.');
    }

    const images = await this.imagekit.uploadMany(files);

    // Trusted-landlord rule: auto-approve future listings once approved.
    const status = landlord.landlordApproved
      ? ListingStatus.APPROVED
      : ListingStatus.PENDING;

    const listing = await this.prisma.listing.create({
      data: {
        title: dto.title,
        rent: dto.rent,
        location: dto.location,
        description: dto.description,
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
      this.mail.sendAdminNewListing(landlord.email, listing);
    }

    return listing;
  }

  /** Public feed: only approved listings, paginated, with optional search. */
  async findPublic(
    query: QueryListingsDto,
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit, search } = query;
    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.APPROVED,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
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
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Public details by UUID or numeric listingNumber; approved only. */
  async findOnePublic(idOrNumber: string) {
    const where = this.idOrNumberWhere(idOrNumber);
    const listing = await this.prisma.listing.findFirst({
      where: { ...where, status: ListingStatus.APPROVED },
      include: listingInclude,
    });
    if (!listing) {
      throw new NotFoundException('Listing not found.');
    }
    return listing;
  }

  /** A landlord's own listings (any status). */
  findMine(landlordId: string) {
    return this.prisma.listing.findMany({
      where: { landlordId },
      include: listingInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, user: AuthUser, dto: UpdateListingDto) {
    const listing = await this.getOwnedOrAdmin(id, user);
    return this.prisma.listing.update({
      where: { id: listing.id },
      data: { ...dto },
      include: listingInclude,
    });
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

  async adminFindAll(status: ListingStatus | undefined, page = 1, limit = 20) {
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
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async setStatus(id: string, status: ListingStatus, reason?: string) {
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
      updated,
      status === ListingStatus.APPROVED,
      reason,
    );

    return updated;
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
