import { Controller, Post, Get, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { AnalyticsService } from '../analytics/analytics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectStatus } from '@prisma/client';

@ApiTags('Webhooks')
@Controller('webhooks/n8n')
@Public() // n8n endpoints use API key auth instead of JWT
export class WebhooksController {
  constructor(
    private configService: ConfigService,
    private analyticsService: AnalyticsService,
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  private validateApiKey(apiKey: string): boolean {
    const validKey = this.configService.get<string>('N8N_WEBHOOK_SECRET');
    if (!validKey) {
      console.warn('N8N_WEBHOOK_SECRET not configured');
      return false;
    }
    return apiKey === validKey;
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for n8n' })
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('idle-projects')
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  @ApiOperation({ summary: 'Get idle projects for n8n automation' })
  async getIdleProjects(@Headers('x-api-key') apiKey: string) {
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const idleProjects = await this.analyticsService.getIdleProjects(7);

    return {
      count: idleProjects.length,
      projects: idleProjects.map((p) => ({
        id: p.id,
        name: p.internalName,
        status: p.status,
        lastUpdated: p.updatedAt,
        manager: p.manager ? { name: p.manager.name, email: p.manager.email } : null,
        teamLead: p.teamLead ? { name: p.teamLead.name, email: p.teamLead.email } : null,
      })),
    };
  }

  @Get('weekly-summary')
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  @ApiOperation({ summary: 'Get weekly summary for n8n automation' })
  async getWeeklySummary(@Headers('x-api-key') apiKey: string) {
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.analyticsService.getWeeklySummary();
  }

  @Get('pending-reviews')
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  @ApiOperation({ summary: 'Get tasks and assets pending review' })
  async getPendingReviews(@Headers('x-api-key') apiKey: string) {
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const [pendingTasks, pendingAssets] = await Promise.all([
      this.prisma.task.findMany({
        where: { status: 'SUBMITTED' },
        include: {
          project: { select: { id: true, internalName: true, teamLeadId: true } },
          assignedTo: { select: { name: true, email: true } },
        },
      }),
      this.prisma.designAsset.findMany({
        where: { status: 'SUBMITTED' },
        include: {
          project: { select: { id: true, internalName: true, teamLeadId: true } },
          uploadedBy: { select: { name: true, email: true } },
        },
      }),
    ]);

    return {
      tasks: {
        count: pendingTasks.length,
        items: pendingTasks.map((t) => ({
          id: t.id,
          title: t.title,
          projectName: t.project.internalName,
          submittedBy: t.assignedTo.name,
          submittedAt: t.submittedAt,
        })),
      },
      assets: {
        count: pendingAssets.length,
        items: pendingAssets.map((a) => ({
          id: a.id,
          name: a.name,
          projectName: a.project.internalName,
          uploadedBy: a.uploadedBy?.name,
        })),
      },
    };
  }

  @Post('project-status-update')
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  @ApiOperation({ summary: 'Update project status via n8n' })
  async updateProjectStatus(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { projectId: string; status: ProjectStatus },
  ) {
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const { projectId, status } = body;

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { status },
      include: {
        manager: { select: { id: true, name: true } },
        teamLead: { select: { id: true, name: true } },
      },
    });

    // Notify relevant users
    if (project.managerId) {
      await this.notificationsService.create({
        userId: project.managerId,
        type: 'project_status_updated',
        title: 'Project Status Updated',
        message: `"${project.internalName}" status changed to ${status}`,
        referenceType: 'project',
        referenceId: projectId,
      });
    }

    return { success: true, project };
  }

  @Post('send-reminder')
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  @ApiOperation({ summary: 'Send reminder notification via n8n' })
  async sendReminder(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { userId: string; title: string; message: string; referenceType?: string; referenceId?: string },
  ) {
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const { userId, title, message, referenceType, referenceId } = body;

    const notification = await this.notificationsService.create({
      userId,
      type: 'reminder',
      title,
      message,
      referenceType,
      referenceId,
    });

    return { success: true, notification };
  }

  @Get('overdue-tasks')
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  @ApiOperation({ summary: 'Get overdue tasks' })
  async getOverdueTasks(@Headers('x-api-key') apiKey: string) {
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const now = new Date();

    const overdueTasks = await this.prisma.task.findMany({
      where: {
        dueDate: { lt: now },
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
      include: {
        project: { select: { id: true, internalName: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return {
      count: overdueTasks.length,
      tasks: overdueTasks.map((t) => ({
        id: t.id,
        title: t.title,
        projectName: t.project.internalName,
        dueDate: t.dueDate,
        daysOverdue: Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24)),
        assignedTo: { name: t.assignedTo.name, email: t.assignedTo.email },
        teamLead: { name: t.assignedBy.name, email: t.assignedBy.email },
      })),
    };
  }

  @Get('client-review-projects')
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  @ApiOperation({ summary: 'Get projects waiting in CLIENT_REVIEW status for too long' })
  async getClientReviewProjects(@Headers('x-api-key') apiKey: string) {
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const now = new Date();
    // Get projects in CLIENT_REVIEW status for more than 2 hours
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const clientReviewProjects = await this.prisma.project.findMany({
      where: {
        status: ProjectStatus.CLIENT_REVIEW,
        updatedAt: { lt: twoHoursAgo },
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        teamLead: { select: { id: true, name: true, email: true } },
        fiverrAccount: { select: { accountName: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });

    return {
      count: clientReviewProjects.length,
      projects: clientReviewProjects.map((p) => {
        const hoursInReview = Math.floor((now.getTime() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60));
        return {
          id: p.id,
          name: p.internalName,
          priority: p.priority,
          fiverrAccount: p.fiverrAccount?.accountName,
          hoursInReview,
          internalDeadline: p.internalDeadline,
          fiverrDeadline: p.fiverrDeadline,
          manager: p.manager ? { id: p.manager.id, name: p.manager.name, email: p.manager.email } : null,
          teamLead: p.teamLead ? { id: p.teamLead.id, name: p.teamLead.name, email: p.teamLead.email } : null,
        };
      }),
    };
  }

  @Get('completed-projects-today')
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  @ApiOperation({ summary: 'Get projects completed today for Admin summary' })
  async getCompletedProjectsToday(@Headers('x-api-key') apiKey: string) {
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const completedProjects = await this.prisma.project.findMany({
      where: {
        status: ProjectStatus.COMPLETED,
        updatedAt: { gte: startOfDay },
      },
      include: {
        manager: { select: { name: true, email: true } },
        teamLead: { select: { name: true, email: true } },
        fiverrAccount: { select: { accountName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get all Admins for notification
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true, name: true, email: true },
    });

    return {
      count: completedProjects.length,
      admins,
      projects: completedProjects.map((p) => ({
        id: p.id,
        name: p.internalName,
        priority: p.priority,
        fiverrAccount: p.fiverrAccount?.accountName,
        completedAt: p.updatedAt,
        manager: p.manager ? { name: p.manager.name, email: p.manager.email } : null,
        teamLead: p.teamLead ? { name: p.teamLead.name, email: p.teamLead.email } : null,
      })),
    };
  }

  @Get('manager-summary/:managerId')
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  @ApiOperation({ summary: 'Get summary of pending items for a specific Manager' })
  async getManagerSummary(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { managerId: string },
  ) {
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const { managerId } = body;

    // Get projects in CLIENT_REVIEW for this manager
    const clientReviewProjects = await this.prisma.project.findMany({
      where: {
        managerId,
        status: ProjectStatus.CLIENT_REVIEW,
      },
      select: { id: true, internalName: true, updatedAt: true, priority: true },
    });

    // Get completed revisions pending acceptance
    const pendingRevisions = await this.prisma.revision.findMany({
      where: {
        status: 'COMPLETED',
        managerAccepted: false,
        project: { managerId },
      },
      include: {
        project: { select: { id: true, internalName: true } },
      },
    });

    // Get projects with unread chat messages (from Admin)
    // This would require a more complex query to check unread messages

    return {
      managerId,
      clientReviewProjects: {
        count: clientReviewProjects.length,
        items: clientReviewProjects.map((p) => ({
          id: p.id,
          name: p.internalName,
          priority: p.priority,
          hoursInReview: Math.floor(
            (Date.now() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60)
          ),
        })),
      },
      pendingRevisions: {
        count: pendingRevisions.length,
        items: pendingRevisions.map((r) => ({
          id: r.id,
          projectName: r.project.internalName,
          description: r.description,
          isPaid: r.isPaid,
        })),
      },
    };
  }

  @Get('pending-revisions-assignment')
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  @ApiOperation({ summary: 'Get revisions pending developer assignment' })
  async getPendingRevisionAssignment(@Headers('x-api-key') apiKey: string) {
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const now = new Date();
    // Revisions not assigned for more than 1 hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const pendingRevisions = await this.prisma.revision.findMany({
      where: {
        status: 'PENDING',
        assignedDeveloperId: null,
        createdAt: { lt: oneHourAgo },
      },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            teamLeadId: true,
            teamLead: { select: { id: true, name: true, email: true } },
          },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      count: pendingRevisions.length,
      revisions: pendingRevisions.map((r) => ({
        id: r.id,
        projectId: r.project.id,
        projectName: r.project.internalName,
        description: r.description,
        isPaid: r.isPaid,
        hoursWaiting: Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60)),
        teamLead: r.project.teamLead ? {
          id: r.project.teamLead.id,
          name: r.project.teamLead.name,
          email: r.project.teamLead.email,
        } : null,
        createdBy: r.createdBy.name,
      })),
    };
  }

  @Post('send-bulk-reminders')
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  @ApiOperation({ summary: 'Send reminders to multiple users at once' })
  async sendBulkReminders(
    @Headers('x-api-key') apiKey: string,
    @Body() body: {
      reminders: Array<{
        userId: string;
        title: string;
        message: string;
        referenceType?: string;
        referenceId?: string;
      }>;
    },
  ) {
    if (!this.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const { reminders } = body;
    const results = [];

    for (const reminder of reminders) {
      const notification = await this.notificationsService.create({
        userId: reminder.userId,
        type: 'n8n_reminder',
        title: reminder.title,
        message: reminder.message,
        referenceType: reminder.referenceType,
        referenceId: reminder.referenceId,
      });
      results.push({ userId: reminder.userId, notificationId: notification.id });
    }

    return { success: true, count: results.length, results };
  }
}
