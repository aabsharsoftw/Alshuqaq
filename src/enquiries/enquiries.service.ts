import { Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';

@Injectable()
export class EnquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Tenant submits an enquiry against an approved listing (middleman model). */
  async create(listingId: string, dto: CreateEnquiryDto) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, status: ListingStatus.APPROVED },
      select: {
        id: true,
        listingNumber: true,
        titleEn: true,
        locationEn: true,
        rent: true,
      },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found or not available.');
    }

    const enquiry = await this.prisma.enquiry.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        message: dto.message,
        listingId: listing.id,
      },
    });

    // Emails are sent in English; map the bilingual fields to a flat summary.
    const summary = {
      listingNumber: listing.listingNumber,
      title: listing.titleEn,
      location: listing.locationEn,
      rent: listing.rent,
    };

    // Notify admin (the middleman) and confirm to the tenant if we have email.
    this.mail.sendAdminNewEnquiry({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      message: dto.message,
      listing: summary,
    });
    if (dto.email) {
      this.mail.sendEnquiryConfirmation(dto.email, dto.name, summary);
    }

    return {
      success: true,
      message:
        'Your enquiry has been submitted. Our team will contact you shortly.',
      enquiryId: enquiry.id,
      listingNumber: listing.listingNumber,
    };
  }

  /** Admin: list all enquiries with their listing reference. */
  async findAll(pagination: PaginationDto) {
    const { page, limit } = pagination;
    const [total, data] = await this.prisma.$transaction([
      this.prisma.enquiry.count(),
      this.prisma.enquiry.findMany({
        include: {
          listing: {
            select: {
              id: true,
              listingNumber: true,
              titleEn: true,
              titleAr: true,
              locationEn: true,
              locationAr: true,
            },
          },
        },
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
}
