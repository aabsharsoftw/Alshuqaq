import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        landlordApproved: true,
        createdAt: true,
      },
    });
  }
}
