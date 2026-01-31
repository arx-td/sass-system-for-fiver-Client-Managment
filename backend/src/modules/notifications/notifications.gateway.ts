import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
  transports: ['polling', 'websocket'],
  allowEIO3: true,
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.userId = payload.sub;
      client.userRole = payload.role;

      // Track connected sockets for this user
      const userId = client.userId!;
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(client.id);

      // Join user-specific room
      client.join(`user:${userId}`);

      console.log(`User ${client.userId} connected to notifications (socket: ${client.id})`);
    } catch (error) {
      console.error('WebSocket authentication failed:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSockets = this.connectedUsers.get(client.userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(client.userId);
        }
      }
      console.log(`User ${client.userId} disconnected from notifications (socket: ${client.id})`);
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId?: string },
  ) {
    if (data.projectId) {
      client.join(`project:${data.projectId}`);
      return { status: 'subscribed', projectId: data.projectId };
    }
    return { status: 'ok' };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId?: string },
  ) {
    if (data.projectId) {
      client.leave(`project:${data.projectId}`);
      return { status: 'unsubscribed', projectId: data.projectId };
    }
    return { status: 'ok' };
  }

  // Send notification to a specific user
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Send notification to all users in a project
  sendToProject(projectId: string, event: string, data: any) {
    this.server.to(`project:${projectId}`).emit(event, data);
  }

  // Notification events
  notifyNewNotification(userId: string, notification: any) {
    this.sendToUser(userId, 'notification:new', notification);
  }

  notifyTaskAssigned(userId: string, task: any) {
    this.sendToUser(userId, 'task:assigned', task);
  }

  notifyTaskStatusChanged(projectId: string, task: any) {
    this.sendToProject(projectId, 'task:status:changed', task);
  }

  notifyAssetSubmitted(userId: string, asset: any) {
    this.sendToUser(userId, 'asset:submitted', asset);
  }

  notifyAssetApproved(userId: string, asset: any) {
    this.sendToUser(userId, 'asset:approved', asset);
  }

  notifyProjectUpdated(projectId: string, project: any) {
    this.sendToProject(projectId, 'project:updated', project);
  }

  notifyRevisionCreated(userId: string, revision: any) {
    this.sendToUser(userId, 'revision:created', revision);
  }

  // Revision assigned to developer (HIGH PRIORITY)
  notifyRevisionAssigned(userId: string, revision: any) {
    this.sendToUser(userId, 'revision:assigned', revision);
  }

  // Revision submitted by developer
  notifyRevisionSubmitted(userId: string, revision: any) {
    this.sendToUser(userId, 'revision:submitted', revision);
  }

  // Revision completed by team lead
  notifyRevisionCompleted(userId: string, revision: any) {
    this.sendToUser(userId, 'revision:completed', revision);
  }

  // Broadcast to all team leads about new pending revision
  notifyTeamLeadsNewRevision(teamLeadId: string, revision: any) {
    this.sendToUser(teamLeadId, 'revision:pending:new', revision);
  }

  notifyChatMessage(projectId: string, message: any) {
    this.sendToProject(projectId, 'chat:message', message);
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    const userSockets = this.connectedUsers.get(userId);
    return userSockets !== undefined && userSockets.size > 0;
  }

  // Get online users count
  getOnlineUsersCount(): number {
    return this.connectedUsers.size;
  }
}
