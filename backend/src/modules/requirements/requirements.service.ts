import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole, RequirementStatus } from '@prisma/client';
import { CreateRequirementDto, UpdateRequirementDto } from './dto';

@Injectable()
export class RequirementsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(
    projectId: string,
    dto: CreateRequirementDto,
    userId: string,
    userRole: UserRole,
  ) {
    // Check project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Only Manager assigned to project or Admin can create requirements
    if (userRole !== UserRole.ADMIN && project.managerId !== userId) {
      throw new ForbiddenException(
        'Only assigned manager can create requirements',
      );
    }

    // Get latest version number
    const latestRequirement = await this.prisma.requirement.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latestRequirement?.version || 0) + 1;

    const requirement = await this.prisma.requirement.create({
      data: {
        projectId,
        version: nextVersion,
        content: dto.content as any,
        attachments: (dto.attachments || []) as any,
        status: RequirementStatus.DRAFT,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Update project status if this is first requirement
    if (nextVersion === 1) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'REQUIREMENTS_PENDING' },
      });
    }

    return requirement;
  }

  async findAllByProject(
    projectId: string,
    userId: string,
    userRole: UserRole,
  ) {
    // Check project exists and user has access
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check access based on role
    if (userRole === UserRole.ADMIN) {
      // Admin has full access
    } else if (userRole === UserRole.MANAGER) {
      if (project.managerId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.TEAM_LEAD) {
      if (project.teamLeadId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.requirement.findMany({
      where: { projectId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { version: 'desc' },
    });
  }

  async findByVersion(
    projectId: string,
    version: number,
    userId: string,
    userRole: UserRole,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check access based on role
    if (userRole === UserRole.ADMIN) {
      // Admin has full access
    } else if (userRole === UserRole.MANAGER) {
      if (project.managerId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.TEAM_LEAD) {
      if (project.teamLeadId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (userRole === UserRole.DEVELOPER) {
      // Developers can only see approved requirements
      const requirement = await this.prisma.requirement.findUnique({
        where: {
          projectId_version: { projectId, version },
        },
      });
      if (requirement?.status !== RequirementStatus.APPROVED) {
        throw new ForbiddenException('Access denied to draft requirements');
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    const requirement = await this.prisma.requirement.findUnique({
      where: {
        projectId_version: { projectId, version },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!requirement) {
      throw new NotFoundException('Requirement version not found');
    }

    return requirement;
  }

  async getLatestApproved(projectId: string) {
    return this.prisma.requirement.findFirst({
      where: {
        projectId,
        status: RequirementStatus.APPROVED,
      },
      orderBy: { version: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async update(
    projectId: string,
    version: number,
    dto: UpdateRequirementDto,
    userId: string,
    userRole: UserRole,
  ) {
    const requirement = await this.prisma.requirement.findUnique({
      where: {
        projectId_version: { projectId, version },
      },
      include: {
        project: true,
      },
    });

    if (!requirement) {
      throw new NotFoundException('Requirement not found');
    }

    // Only Manager assigned to project or Admin can update
    if (
      userRole !== UserRole.ADMIN &&
      requirement.project.managerId !== userId
    ) {
      throw new ForbiddenException('Only assigned manager can update requirements');
    }

    // Cannot update approved requirements
    if (requirement.status === RequirementStatus.APPROVED) {
      throw new BadRequestException(
        'Cannot update approved requirements. Create a new version instead.',
      );
    }

    return this.prisma.requirement.update({
      where: {
        projectId_version: { projectId, version },
      },
      data: {
        content: dto.content as any,
        attachments: dto.attachments as any,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async approve(
    projectId: string,
    version: number,
    userId: string,
    userRole: UserRole,
  ) {
    const requirement = await this.prisma.requirement.findUnique({
      where: {
        projectId_version: { projectId, version },
      },
      include: {
        project: true,
      },
    });

    if (!requirement) {
      throw new NotFoundException('Requirement not found');
    }

    // Only Manager assigned to project or Admin can approve
    if (
      userRole !== UserRole.ADMIN &&
      requirement.project.managerId !== userId
    ) {
      throw new ForbiddenException('Only assigned manager can approve requirements');
    }

    if (requirement.status === RequirementStatus.APPROVED) {
      throw new BadRequestException('Requirement is already approved');
    }

    // Get approver name for notification
    const approver = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Update requirement to approved
    const updated = await this.prisma.requirement.update({
      where: {
        projectId_version: { projectId, version },
      },
      data: {
        status: RequirementStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Update project status if it was requirements pending
    if (requirement.project.status === 'REQUIREMENTS_PENDING') {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    // Notify team lead that requirements have been approved
    if (requirement.project.teamLeadId) {
      await this.notificationsService.notifyRequirementsApproved(
        projectId,
        requirement.project.internalName,
        requirement.project.teamLeadId,
        approver?.name || 'Manager',
      );
    }

    return updated;
  }
}
