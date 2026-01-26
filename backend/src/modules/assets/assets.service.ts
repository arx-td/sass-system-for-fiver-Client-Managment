import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestAssetDto, SubmitAssetDto, UpdateAssetDto, QueryAssetsDto } from './dto';
import { AssetStatus, UserRole, Prisma } from '@prisma/client';

@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async request(projectId: string, dto: RequestAssetDto, userId: string) {
    // Verify project exists and user is the Team Lead
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.teamLeadId !== userId) {
      throw new ForbiddenException('Only the Team Lead can request assets');
    }

    if (!project.designerId) {
      throw new BadRequestException('No designer assigned to this project');
    }

    // Get team lead name for notification
    const teamLead = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const asset = await this.prisma.designAsset.create({
      data: {
        projectId,
        name: dto.name,
        assetType: dto.assetType,
        description: dto.description,
        referenceAttachments: dto.attachments ? (dto.attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        requestedById: userId,
        status: AssetStatus.REQUESTED,
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Notify designer about asset request
    await this.notificationsService.notifyAssetRequested(
      asset.id,
      asset.name,
      project.internalName,
      project.designerId,
      teamLead?.name || 'Team Lead',
    );

    return asset;
  }

  async findAllByProject(projectId: string, query: QueryAssetsDto, userId: string, userRole: UserRole) {
    const { status, assetType, page = 1, limit = 50 } = query;

    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const where: any = { projectId };

    if (status) {
      where.status = status;
    }

    if (assetType) {
      where.assetType = assetType;
    }

    // Developer can only see approved assets
    if (userRole === UserRole.DEVELOPER) {
      where.status = AssetStatus.APPROVED;
    }

    const [assets, total] = await Promise.all([
      this.prisma.designAsset.findMany({
        where,
        include: {
          requestedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          uploadedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.designAsset.count({ where }),
    ]);

    return {
      data: assets,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAssignedToDesigner(userId: string, query: QueryAssetsDto) {
    const { status, assetType, page = 1, limit = 50 } = query;

    // Get all projects where user is the designer
    const projects = await this.prisma.project.findMany({
      where: { designerId: userId },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);

    const where: any = {
      projectId: { in: projectIds },
    };

    if (status) {
      where.status = status;
    }

    if (assetType) {
      where.assetType = assetType;
    }

    const [assets, total] = await Promise.all([
      this.prisma.designAsset.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              internalName: true,
            },
          },
          requestedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.designAsset.count({ where }),
    ]);

    return {
      data: assets,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: UserRole) {
    const asset = await this.prisma.designAsset.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            teamLeadId: true,
            designerId: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Developer can only see approved assets
    if (userRole === UserRole.DEVELOPER && asset.status !== AssetStatus.APPROVED) {
      throw new ForbiddenException('You can only view approved assets');
    }

    return asset;
  }

  async update(id: string, dto: UpdateAssetDto, userId: string) {
    const asset = await this.prisma.designAsset.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Only Team Lead can update asset requirements
    if (asset.project.teamLeadId !== userId) {
      throw new ForbiddenException('Only the Team Lead can update asset requirements');
    }

    // Cannot update approved assets
    if (asset.status === AssetStatus.APPROVED) {
      throw new BadRequestException('Cannot update approved assets');
    }

    return this.prisma.designAsset.update({
      where: { id },
      data: {
        name: dto.name,
        assetType: dto.assetType,
        description: dto.description,
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async startWork(id: string, userId: string) {
    const asset = await this.prisma.designAsset.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            designerId: true,
            teamLeadId: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Only designer can start work
    if (asset.project.designerId !== userId) {
      throw new ForbiddenException('Only the assigned designer can work on this asset');
    }

    // Can only start if status is REQUESTED or REJECTED
    const validStartStatuses: AssetStatus[] = [AssetStatus.REQUESTED, AssetStatus.REJECTED];
    if (!validStartStatuses.includes(asset.status)) {
      throw new BadRequestException('Asset cannot be started in current status');
    }

    // Get designer name for notification
    const designer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const updatedAsset = await this.prisma.designAsset.update({
      where: { id },
      data: {
        status: AssetStatus.IN_PROGRESS,
      },
    });

    // Notify team lead that designer started working
    if (asset.project.teamLeadId) {
      await this.notificationsService.notifyMultipleUsers(
        [asset.project.teamLeadId],
        'asset_started',
        'Asset Work Started',
        `${designer?.name || 'Designer'} has started working on "${asset.name}" for ${asset.project.internalName}`,
        'asset',
        asset.id,
      );
    }

    return updatedAsset;
  }

  async submit(id: string, dto: SubmitAssetDto, userId: string) {
    const asset = await this.prisma.designAsset.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            designerId: true,
            teamLeadId: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Only designer can submit
    if (asset.project.designerId !== userId) {
      throw new ForbiddenException('Only the assigned designer can submit this asset');
    }

    // Can submit from IN_PROGRESS, REQUESTED, or REJECTED status
    const validSubmitStatuses: AssetStatus[] = [AssetStatus.IN_PROGRESS, AssetStatus.REQUESTED, AssetStatus.REJECTED];
    if (!validSubmitStatuses.includes(asset.status)) {
      throw new BadRequestException('Asset cannot be submitted in current status');
    }

    // Get designer name for notification
    const designer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const updatedAsset = await this.prisma.designAsset.update({
      where: { id },
      data: {
        status: AssetStatus.SUBMITTED,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        uploadedById: userId,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Notify team lead about asset submission
    if (asset.project.teamLeadId) {
      await this.notificationsService.notifyAssetSubmitted(
        asset.id,
        asset.name,
        asset.project.internalName,
        asset.project.teamLeadId,
        designer?.name || 'Designer',
      );
    }

    return updatedAsset;
  }

  async approve(id: string, userId: string) {
    const asset = await this.prisma.designAsset.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            designerId: true,
            teamLeadId: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Only Team Lead can approve
    if (asset.project.teamLeadId !== userId) {
      throw new ForbiddenException('Only the Team Lead can approve assets');
    }

    // Can only approve if submitted
    if (asset.status !== AssetStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted assets can be approved');
    }

    const updatedAsset = await this.prisma.designAsset.update({
      where: { id },
      data: {
        status: AssetStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        approvedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Notify designer about approval
    if (asset.project.designerId) {
      await this.notificationsService.notifyAssetApproved(
        asset.id,
        asset.name,
        asset.project.designerId,
      );
    }

    // Notify developers assigned to project tasks about new asset
    const projectTasks = await this.prisma.task.findMany({
      where: { projectId: asset.project.id },
      select: { assignedToId: true },
    });

    const developerIds = [...new Set(projectTasks.map((t) => t.assignedToId))];
    if (developerIds.length > 0) {
      await this.notificationsService.notifyDevelopersAssetApproved(
        asset.id,
        asset.name,
        asset.project.internalName,
        developerIds,
      );
    }

    return updatedAsset;
  }

  async reject(id: string, userId: string) {
    const asset = await this.prisma.designAsset.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            designerId: true,
            teamLeadId: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Only Team Lead can reject
    if (asset.project.teamLeadId !== userId) {
      throw new ForbiddenException('Only the Team Lead can reject assets');
    }

    // Can only reject if submitted
    if (asset.status !== AssetStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted assets can be rejected');
    }

    const updatedAsset = await this.prisma.designAsset.update({
      where: { id },
      data: {
        status: AssetStatus.REJECTED,
      },
    });

    // Notify designer about rejection
    if (asset.project.designerId) {
      await this.notificationsService.notifyAssetRejected(
        asset.id,
        asset.name,
        asset.project.designerId,
      );
    }

    return updatedAsset;
  }

  async delete(id: string, userId: string) {
    const asset = await this.prisma.designAsset.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Only Team Lead can delete
    if (asset.project.teamLeadId !== userId) {
      throw new ForbiddenException('Only the Team Lead can delete assets');
    }

    // Cannot delete approved assets
    if (asset.status === AssetStatus.APPROVED) {
      throw new BadRequestException('Cannot delete approved assets');
    }

    return this.prisma.designAsset.delete({
      where: { id },
    });
  }

  async getAssetStats(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const stats = await this.prisma.designAsset.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    });

    const result = {
      total: 0,
      requested: 0,
      inProgress: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
    };

    stats.forEach((stat) => {
      result.total += stat._count;
      switch (stat.status) {
        case AssetStatus.REQUESTED:
          result.requested = stat._count;
          break;
        case AssetStatus.IN_PROGRESS:
          result.inProgress = stat._count;
          break;
        case AssetStatus.SUBMITTED:
          result.submitted = stat._count;
          break;
        case AssetStatus.APPROVED:
          result.approved = stat._count;
          break;
        case AssetStatus.REJECTED:
          result.rejected = stat._count;
          break;
      }
    });

    return result;
  }
}
