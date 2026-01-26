import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { ChatService } from './chat.service';
import { UserRole } from '@prisma/client';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: UserRole;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string[]>(); // userId -> socketIds

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      // Verify token
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      // Attach user to socket
      client.user = {
        id: payload.sub,
        role: payload.role,
      };

      // Track connected user
      const existingSockets = this.connectedUsers.get(payload.sub) || [];
      existingSockets.push(client.id);
      this.connectedUsers.set(payload.sub, existingSockets);

      console.log(`User ${payload.sub} connected via socket ${client.id}`);
    } catch (error) {
      console.error('Socket authentication failed:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      const sockets = this.connectedUsers.get(client.user.id) || [];
      const updatedSockets = sockets.filter((id) => id !== client.id);

      if (updatedSockets.length === 0) {
        this.connectedUsers.delete(client.user.id);
      } else {
        this.connectedUsers.set(client.user.id, updatedSockets);
      }

      console.log(`User ${client.user.id} disconnected socket ${client.id}`);
    }
  }

  @SubscribeMessage('join:project')
  async handleJoinProject(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    if (!client.user) {
      return { error: 'Unauthorized' };
    }

    const room = `project:${data.projectId}`;
    await client.join(room);

    console.log(`User ${client.user.id} joined room ${room}`);

    return { success: true, room };
  }

  @SubscribeMessage('join:user')
  async handleJoinUser(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string },
  ) {
    if (!client.user) {
      return { error: 'Unauthorized' };
    }

    // Join user's personal notification room
    const room = `user:${data.userId}`;
    await client.join(room);

    console.log(`User ${client.user.id} joined personal room ${room}`);

    return { success: true, room };
  }

  @SubscribeMessage('leave:project')
  async handleLeaveProject(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    const room = `project:${data.projectId}`;
    await client.leave(room);

    return { success: true };
  }

  @SubscribeMessage('chat:message')
  async handleChatMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      projectId: string;
      message: string;
      attachments?: Array<{ url: string; fileName: string; mimeType?: string; size?: number }>;
      visibleToRoles?: UserRole[];
    },
  ) {
    if (!client.user) {
      return { error: 'Unauthorized' };
    }

    try {
      const savedMessage = await this.chatService.createMessage(
        data.projectId,
        {
          message: data.message,
          attachments: data.attachments,
          visibleToRoles: data.visibleToRoles,
        },
        client.user.id,
        client.user.role,
      );

      // Emit to all clients in the project room
      this.server
        .to(`project:${data.projectId}`)
        .emit('chat:message', savedMessage);

      return { success: true, message: savedMessage };
    } catch (error) {
      console.error('Error sending message:', error);
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('chat:typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string; isTyping: boolean },
  ) {
    if (!client.user) {
      return;
    }

    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: client.user.id },
      select: { id: true, name: true },
    });

    // Broadcast typing status to others in the room
    client
      .to(`project:${data.projectId}`)
      .emit('chat:typing', {
        userId: client.user.id,
        userName: user?.name,
        isTyping: data.isTyping,
      });
  }

  // Helper method to emit to specific users
  emitToUser(userId: string, event: string, data: any) {
    const sockets = this.connectedUsers.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  // Helper method to emit to a project room
  emitToProject(projectId: string, event: string, data: any) {
    this.server.to(`project:${projectId}`).emit(event, data);
  }

  // Helper method to send chat notification to relevant users
  async notifyChatMessage(message: any, projectId: string) {
    try {
      // Get project with team members
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          internalName: true,
          managerId: true,
          teamLeadId: true,
          designerId: true,
          tasks: {
            select: { assignedToId: true },
            distinct: ['assignedToId'],
          },
        },
      });

      if (!project) return;

      const visibleRoles = message.visibleToRoles || [];

      // Get all admins if ADMIN is in visibleToRoles
      let adminIds: string[] = [];
      if (visibleRoles.includes('ADMIN')) {
        const admins = await this.prisma.user.findMany({
          where: { role: 'ADMIN', status: 'ACTIVE' },
          select: { id: true },
        });
        adminIds = admins.map((a) => a.id);
      }

      // Collect all user IDs who should receive the notification
      const recipientIds = new Set<string>();

      // Add admins
      adminIds.forEach((id) => recipientIds.add(id));

      // Add manager if MANAGER is in visibleRoles
      if (visibleRoles.includes('MANAGER') && project.managerId) {
        recipientIds.add(project.managerId);
      }

      // Add team lead if TEAM_LEAD is in visibleRoles
      if (visibleRoles.includes('TEAM_LEAD') && project.teamLeadId) {
        recipientIds.add(project.teamLeadId);
      }

      // Add designer if DESIGNER is in visibleRoles
      if (visibleRoles.includes('DESIGNER') && project.designerId) {
        recipientIds.add(project.designerId);
      }

      // Add developers if DEVELOPER is in visibleRoles
      if (visibleRoles.includes('DEVELOPER')) {
        project.tasks.forEach((task) => {
          recipientIds.add(task.assignedToId);
        });
      }

      // Remove sender from recipients
      recipientIds.delete(message.senderId);

      // Send notification to each recipient
      const notificationData = {
        message,
        projectName: project.internalName,
      };

      recipientIds.forEach((userId) => {
        // Send to user's personal room
        this.server.to(`user:${userId}`).emit('chat:notification', notificationData);
      });

      console.log(`Chat notification sent to ${recipientIds.size} users for project ${project.internalName}`);
    } catch (error) {
      console.error('Error sending chat notifications:', error);
    }
  }
}
