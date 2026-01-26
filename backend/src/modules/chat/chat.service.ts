import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { CreateMessageDto } from './dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async createMessage(
    projectId: string,
    dto: CreateMessageDto,
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
    await this.checkProjectAccess(project, userId, userRole);

    // Set default visible roles based on sender role
    let visibleToRoles = dto.visibleToRoles;
    if (!visibleToRoles || visibleToRoles.length === 0) {
      // Default visibility for project team communication
      if (userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) {
        // Admin/Manager chat is private between them by default
        visibleToRoles = [UserRole.ADMIN, UserRole.MANAGER];
      } else {
        // Team members (Team Lead, Developer, Designer) can see each other's messages
        // This enables team collaboration
        visibleToRoles = [
          UserRole.ADMIN,
          UserRole.MANAGER,
          UserRole.TEAM_LEAD,
          UserRole.DEVELOPER,
          UserRole.DESIGNER,
        ];
      }
    }

    return this.prisma.chatMessage.create({
      data: {
        projectId,
        senderId: userId,
        message: dto.message,
        attachments: (dto.attachments || []) as any,
        priority: dto.priority || 'NORMAL',
        visibleToRoles: visibleToRoles as any,
        mentions: (dto.mentions || []) as any,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
      },
    });
  }

  async getMessages(
    projectId: string,
    userId: string,
    userRole: UserRole,
    page = 1,
    limit = 50,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check access
    await this.checkProjectAccess(project, userId, userRole);

    // Get all messages for the project and filter by role visibility in JavaScript
    // (Prisma's `has` operator doesn't work on Json fields containing arrays)
    const allMessages = await this.prisma.chatMessage.findMany({
      where: { projectId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter messages visible to user's role
    const visibleMessages = allMessages.filter((msg) => {
      const roles = msg.visibleToRoles as string[];
      return Array.isArray(roles) && roles.includes(userRole);
    });

    const total = visibleMessages.length;
    const skip = (page - 1) * limit;
    const paginatedMessages = visibleMessages.slice(skip, skip + limit);

    return {
      data: paginatedMessages.reverse(), // Return in chronological order
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get recent messages across all user's projects
  async getRecentMessagesForUser(userId: string, userRole: UserRole, limit = 20) {
    // Get projects the user has access to
    let projectIds: string[] = [];

    if (userRole === UserRole.ADMIN) {
      // Admin sees all projects
      const projects = await this.prisma.project.findMany({
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
    } else if (userRole === UserRole.MANAGER) {
      const projects = await this.prisma.project.findMany({
        where: { managerId: userId },
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
    } else if (userRole === UserRole.TEAM_LEAD) {
      const projects = await this.prisma.project.findMany({
        where: { teamLeadId: userId },
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
    } else if (userRole === UserRole.DESIGNER) {
      const projects = await this.prisma.project.findMany({
        where: { designerId: userId },
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
    } else if (userRole === UserRole.DEVELOPER) {
      const tasks = await this.prisma.task.findMany({
        where: { assignedToId: userId },
        select: { projectId: true },
        distinct: ['projectId'],
      });
      projectIds = tasks.map((t) => t.projectId);
    }

    if (projectIds.length === 0) {
      return { data: [], total: 0 };
    }

    // Get recent messages from these projects
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        projectId: { in: projectIds },
        senderId: { not: userId }, // Don't show own messages
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        project: {
          select: {
            id: true,
            internalName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Get more to filter by role
    });

    // Filter by role visibility
    const visibleMessages = messages
      .filter((msg) => {
        const roles = msg.visibleToRoles as string[];
        return Array.isArray(roles) && roles.includes(userRole);
      })
      .slice(0, limit)
      .map((msg) => ({
        ...msg,
        projectName: msg.project.internalName,
      }));

    return {
      data: visibleMessages,
      total: visibleMessages.length,
    };
  }

  // Get unread message count for n8n reminders
  async getUnreadMessagesCount(userId: string, userRole: UserRole, sinceMinutes = 60) {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);

    // Get user's project IDs
    let projectIds: string[] = [];

    if (userRole === UserRole.ADMIN) {
      const projects = await this.prisma.project.findMany({ select: { id: true } });
      projectIds = projects.map((p) => p.id);
    } else if (userRole === UserRole.MANAGER) {
      const projects = await this.prisma.project.findMany({
        where: { managerId: userId },
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
    } else if (userRole === UserRole.TEAM_LEAD) {
      const projects = await this.prisma.project.findMany({
        where: { teamLeadId: userId },
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
    } else if (userRole === UserRole.DESIGNER) {
      const projects = await this.prisma.project.findMany({
        where: { designerId: userId },
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
    } else if (userRole === UserRole.DEVELOPER) {
      const tasks = await this.prisma.task.findMany({
        where: { assignedToId: userId },
        select: { projectId: true },
        distinct: ['projectId'],
      });
      projectIds = tasks.map((t) => t.projectId);
    }

    if (projectIds.length === 0) {
      return { count: 0, messages: [] };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        projectId: { in: projectIds },
        senderId: { not: userId },
        createdAt: { gte: since },
      },
      include: {
        sender: { select: { name: true, role: true } },
        project: { select: { internalName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const visibleMessages = messages.filter((msg) => {
      const roles = msg.visibleToRoles as string[];
      return Array.isArray(roles) && roles.includes(userRole);
    });

    return {
      count: visibleMessages.length,
      messages: visibleMessages.slice(0, 5).map((m) => ({
        id: m.id,
        message: m.message.substring(0, 100),
        senderName: m.sender.name,
        projectName: m.project.internalName,
        createdAt: m.createdAt,
      })),
    };
  }

  async updateMessage(messageId: string, newMessage: string, userId: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only the sender can edit their own message
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        message: newMessage,
        updatedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
      },
    });
  }

  async deleteMessage(messageId: string, userId: string, userRole: UserRole) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Admin can delete any message, others can only delete their own
    if (userRole !== UserRole.ADMIN && message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.chatMessage.delete({
      where: { id: messageId },
    });

    return { success: true };
  }

  private async checkProjectAccess(
    project: { id: string; managerId: string | null; teamLeadId: string | null; designerId: string | null },
    userId: string,
    userRole: UserRole,
  ) {
    if (userRole === UserRole.ADMIN) {
      return; // Admin has full access
    }

    if (userRole === UserRole.MANAGER) {
      if (project.managerId !== userId) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    if (userRole === UserRole.TEAM_LEAD) {
      if (project.teamLeadId !== userId) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    if (userRole === UserRole.DESIGNER) {
      if (project.designerId !== userId) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    // For developers, check if they have tasks assigned
    if (userRole === UserRole.DEVELOPER) {
      const hasTask = await this.prisma.task.findFirst({
        where: {
          projectId: project.id,
          assignedToId: userId,
        },
      });
      if (!hasTask) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    throw new ForbiddenException('Access denied');
  }
}
