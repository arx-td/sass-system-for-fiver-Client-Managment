import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateFiverrAccountDto, UpdateFiverrAccountDto } from './dto';

@Injectable()
export class FiverrAccountsService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateFiverrAccountDto, userId: string) {
    // Check if account name already exists
    const existing = await this.prisma.fiverrAccount.findUnique({
      where: { accountName: createDto.accountName },
    });

    if (existing) {
      throw new ConflictException('Fiverr account with this name already exists');
    }

    const account = await this.prisma.fiverrAccount.create({
      data: {
        accountName: createDto.accountName,
        accountEmail: createDto.accountEmail,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    return account;
  }

  async findAll() {
    const accounts = await this.prisma.fiverrAccount.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            projects: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return accounts;
  }

  async findAllActive() {
    const accounts = await this.prisma.fiverrAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        accountName: true,
      },
      orderBy: { accountName: 'asc' },
    });

    return accounts;
  }

  async findOne(id: string) {
    const account = await this.prisma.fiverrAccount.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        projects: {
          select: {
            id: true,
            internalName: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Fiverr account not found');
    }

    return account;
  }

  async update(id: string, updateDto: UpdateFiverrAccountDto) {
    const account = await this.prisma.fiverrAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('Fiverr account not found');
    }

    // Check if new name conflicts with existing
    if (updateDto.accountName && updateDto.accountName !== account.accountName) {
      const existing = await this.prisma.fiverrAccount.findUnique({
        where: { accountName: updateDto.accountName },
      });

      if (existing) {
        throw new ConflictException('Fiverr account with this name already exists');
      }
    }

    const updated = await this.prisma.fiverrAccount.update({
      where: { id },
      data: updateDto,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    return updated;
  }

  async remove(id: string) {
    const account = await this.prisma.fiverrAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Fiverr account not found');
    }

    if (account._count.projects > 0) {
      throw new BadRequestException(
        `Cannot delete account with ${account._count.projects} associated projects. Deactivate it instead.`,
      );
    }

    await this.prisma.fiverrAccount.delete({
      where: { id },
    });

    return { message: 'Fiverr account deleted successfully' };
  }

  async getStats() {
    const [total, active, inactive, withProjects] = await Promise.all([
      this.prisma.fiverrAccount.count(),
      this.prisma.fiverrAccount.count({ where: { isActive: true } }),
      this.prisma.fiverrAccount.count({ where: { isActive: false } }),
      this.prisma.fiverrAccount.count({
        where: {
          projects: {
            some: {},
          },
        },
      }),
    ]);

    return {
      total,
      active,
      inactive,
      withProjects,
    };
  }
}
