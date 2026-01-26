import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificationDto, QueryNotificationsDto } from './dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
  ) {}

  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
      },
    });

    // Emit WebSocket event for real-time notification
    try {
      this.notificationsGateway.notifyNewNotification(dto.userId, notification);
      console.log(`[NOTIFICATION] Real-time notification sent to user ${dto.userId}: ${dto.title}`);
    } catch (error) {
      console.error('[NOTIFICATION] Failed to send real-time notification:', error.message);
    }

    return notification;
  }

  async findAllForUser(userId: string, query: QueryNotificationsDto) {
    const { isRead, page = 1, limit = 20 } = query;

    const where: any = { userId };

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount: await this.getUnreadCount(userId),
      },
    };
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { message: 'All notifications marked as read' };
  }

  async delete(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.delete({
      where: { id },
    });
  }

  // Helper methods for creating specific notification types
  async notifyTaskAssigned(taskId: string, taskTitle: string, projectName: string, developerId: string, teamLeadName: string) {
    return this.create({
      userId: developerId,
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: `${teamLeadName} assigned you "${taskTitle}" in ${projectName}`,
      referenceType: 'task',
      referenceId: taskId,
    });
  }

  async notifyTaskSubmitted(taskId: string, taskTitle: string, projectName: string, teamLeadId: string, developerName: string) {
    return this.create({
      userId: teamLeadId,
      type: 'task_submitted',
      title: 'Task Submitted for Review',
      message: `${developerName} submitted "${taskTitle}" in ${projectName}`,
      referenceType: 'task',
      referenceId: taskId,
    });
  }

  async notifyTaskApproved(taskId: string, taskTitle: string, developerId: string) {
    return this.create({
      userId: developerId,
      type: 'task_approved',
      title: 'Task Approved',
      message: `Your task "${taskTitle}" has been approved`,
      referenceType: 'task',
      referenceId: taskId,
    });
  }

  async notifyTaskRejected(taskId: string, taskTitle: string, developerId: string) {
    return this.create({
      userId: developerId,
      type: 'task_rejected',
      title: 'Task Rejected',
      message: `Your task "${taskTitle}" was rejected. Please review and resubmit.`,
      referenceType: 'task',
      referenceId: taskId,
    });
  }

  async notifyAssetRequested(assetId: string, assetName: string, projectName: string, designerId: string, teamLeadName: string) {
    return this.create({
      userId: designerId,
      type: 'asset_requested',
      title: 'New Asset Requested',
      message: `${teamLeadName} requested "${assetName}" for ${projectName}`,
      referenceType: 'asset',
      referenceId: assetId,
    });
  }

  async notifyAssetSubmitted(assetId: string, assetName: string, projectName: string, teamLeadId: string, designerName: string) {
    return this.create({
      userId: teamLeadId,
      type: 'asset_submitted',
      title: 'Asset Submitted for Review',
      message: `${designerName} submitted "${assetName}" for ${projectName}`,
      referenceType: 'asset',
      referenceId: assetId,
    });
  }

  async notifyAssetApproved(assetId: string, assetName: string, designerId: string) {
    return this.create({
      userId: designerId,
      type: 'asset_approved',
      title: 'Asset Approved',
      message: `Your asset "${assetName}" has been approved`,
      referenceType: 'asset',
      referenceId: assetId,
    });
  }

  async notifyAssetRejected(assetId: string, assetName: string, designerId: string) {
    return this.create({
      userId: designerId,
      type: 'asset_rejected',
      title: 'Asset Rejected',
      message: `Your asset "${assetName}" was rejected. Please review and resubmit.`,
      referenceType: 'asset',
      referenceId: assetId,
    });
  }

  async notifyProjectAssigned(projectId: string, projectName: string, userId: string, role: string, assignerName: string) {
    return this.create({
      userId,
      type: 'project_assigned',
      title: `Assigned as ${role}`,
      message: `${assignerName} assigned you as ${role} to "${projectName}"`,
      referenceType: 'project',
      referenceId: projectId,
    });
  }

  async notifyRevisionCreated(projectId: string, projectName: string, teamLeadId: string, managerName: string) {
    return this.create({
      userId: teamLeadId,
      type: 'revision_created',
      title: 'New Revision Request',
      message: `${managerName} created a revision request for "${projectName}"`,
      referenceType: 'project',
      referenceId: projectId,
    });
  }

  async notifyNewChatMessage(projectId: string, projectName: string, recipientId: string, senderName: string) {
    return this.create({
      userId: recipientId,
      type: 'chat_message',
      title: 'New Message',
      message: `${senderName} sent a message in "${projectName}"`,
      referenceType: 'project',
      referenceId: projectId,
    });
  }

  async notifyUserAcceptedInvite(acceptedUserId: string, acceptedUserName: string, acceptedUserRole: string) {
    // Get all admins to notify them
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });

    // Create notification for each admin
    const notifications = admins.map((admin) =>
      this.create({
        userId: admin.id,
        type: 'user_accepted_invite',
        title: 'User Accepted Invitation',
        message: `${acceptedUserName} (${acceptedUserRole}) has accepted the invitation and joined the team`,
        referenceType: 'user',
        referenceId: acceptedUserId,
      })
    );

    return Promise.all(notifications);
  }

  // =============================================
  // ADDITIONAL NOTIFICATION METHODS
  // =============================================

  // Task started by developer
  async notifyTaskStarted(taskId: string, taskTitle: string, projectName: string, teamLeadId: string, developerName: string) {
    return this.create({
      userId: teamLeadId,
      type: 'task_started',
      title: 'Task Started',
      message: `${developerName} has started working on "${taskTitle}" in ${projectName}`,
      referenceType: 'task',
      referenceId: taskId,
    });
  }

  // Project status changed
  async notifyProjectStatusChanged(
    projectId: string,
    projectName: string,
    newStatus: string,
    userIds: string[],
    changedByName: string,
  ) {
    const statusLabels: Record<string, string> = {
      NEW: 'New',
      REQUIREMENTS_PENDING: 'Requirements Pending',
      IN_PROGRESS: 'In Progress',
      REVIEW: 'Under Review',
      CLIENT_REVIEW: 'Client Review',
      COMPLETED: 'Completed',
      ON_HOLD: 'On Hold',
      CANCELLED: 'Cancelled',
    };

    const statusLabel = statusLabels[newStatus] || newStatus;

    const notifications = userIds.map((userId) =>
      this.create({
        userId,
        type: 'project_status_changed',
        title: 'Project Status Updated',
        message: `"${projectName}" status changed to ${statusLabel} by ${changedByName}`,
        referenceType: 'project',
        referenceId: projectId,
      })
    );

    return Promise.all(notifications);
  }

  // Requirements approved
  async notifyRequirementsApproved(
    projectId: string,
    projectName: string,
    teamLeadId: string,
    approverName: string,
  ) {
    return this.create({
      userId: teamLeadId,
      type: 'requirements_approved',
      title: 'Requirements Approved',
      message: `Requirements for "${projectName}" have been approved by ${approverName}. You can now create tasks.`,
      referenceType: 'project',
      referenceId: projectId,
    });
  }

  // Revision completed
  async notifyRevisionCompleted(
    projectId: string,
    projectName: string,
    userIds: string[],
    completedByName: string,
  ) {
    const notifications = userIds.map((userId) =>
      this.create({
        userId,
        type: 'revision_completed',
        title: 'Revision Completed',
        message: `Revision for "${projectName}" has been completed by ${completedByName}`,
        referenceType: 'project',
        referenceId: projectId,
      })
    );

    return Promise.all(notifications);
  }

  // Designer assigned to project
  async notifyDesignerAssigned(
    projectId: string,
    projectName: string,
    designerId: string,
    assignerName: string,
  ) {
    return this.create({
      userId: designerId,
      type: 'project_assigned',
      title: 'Assigned to Project',
      message: `${assignerName} assigned you as Designer to "${projectName}"`,
      referenceType: 'project',
      referenceId: projectId,
    });
  }

  // Team Lead assigned to project
  async notifyTeamLeadAssigned(
    projectId: string,
    projectName: string,
    teamLeadId: string,
    assignerName: string,
  ) {
    return this.create({
      userId: teamLeadId,
      type: 'project_assigned',
      title: 'Assigned as Team Lead',
      message: `${assignerName} assigned you as Team Lead to "${projectName}"`,
      referenceType: 'project',
      referenceId: projectId,
    });
  }

  // Manager assigned to project
  async notifyManagerAssigned(
    projectId: string,
    projectName: string,
    managerId: string,
    assignerName: string,
  ) {
    return this.create({
      userId: managerId,
      type: 'project_assigned',
      title: 'Assigned as Manager',
      message: `${assignerName} assigned you as Manager to "${projectName}"`,
      referenceType: 'project',
      referenceId: projectId,
    });
  }

  // Notify multiple developers about new asset
  async notifyDevelopersAssetApproved(
    assetId: string,
    assetName: string,
    projectName: string,
    developerIds: string[],
  ) {
    const notifications = developerIds.map((developerId) =>
      this.create({
        userId: developerId,
        type: 'asset_approved',
        title: 'New Asset Available',
        message: `Design asset "${assetName}" is now available for "${projectName}"`,
        referenceType: 'asset',
        referenceId: assetId,
      })
    );

    return Promise.all(notifications);
  }

  // Project marked as delivered by Team Lead
  async notifyProjectDelivered(
    projectId: string,
    projectName: string,
    managerId: string,
    teamLeadName: string,
  ) {
    return this.create({
      userId: managerId,
      type: 'project_status_changed',
      title: 'Project Delivered',
      message: `${teamLeadName} has marked "${projectName}" as delivered and ready for review`,
      referenceType: 'project',
      referenceId: projectId,
    });
  }

  // Project sent to client
  async notifyProjectSentToClient(
    projectId: string,
    projectName: string,
    teamLeadId: string,
    senderName: string,
  ) {
    return this.create({
      userId: teamLeadId,
      type: 'project_status_changed',
      title: 'Project Sent to Client',
      message: `"${projectName}" has been sent to the client for review by ${senderName}`,
      referenceType: 'project',
      referenceId: projectId,
    });
  }

  // Client requested changes
  async notifyClientRequestedChanges(
    projectId: string,
    projectName: string,
    teamLeadId: string,
    reportedByName: string,
  ) {
    return this.create({
      userId: teamLeadId,
      type: 'revision_created',
      title: 'Client Requested Changes',
      message: `Client has requested changes for "${projectName}". Reported by ${reportedByName}`,
      referenceType: 'project',
      referenceId: projectId,
    });
  }

  // Bulk notification helper
  async notifyMultipleUsers(
    userIds: string[],
    type: string,
    title: string,
    message: string,
    referenceType?: string,
    referenceId?: string,
  ) {
    const notifications = userIds.map((userId) =>
      this.create({
        userId,
        type,
        title,
        message,
        referenceType,
        referenceId,
      })
    );

    return Promise.all(notifications);
  }
}
