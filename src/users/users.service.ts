import { Injectable } from '@nestjs/common';
import { Language, Prisma, Role, User } from '@prisma/client';
import { Lang, toLanguageEnum } from '../common/i18n/localize';
import { PrismaService } from '../prisma/prisma.service';

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
}
