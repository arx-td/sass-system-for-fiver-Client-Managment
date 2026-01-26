import {
  Controller,
  Get,
  Post,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ChatGateway } from './chat.gateway';

@ApiTags('n8n-webhooks')
@Controller('webhooks/n8n')
export class ChatN8nController {
  constructor(
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  // Verify n8n API key
  private verifyApiKey(apiKey: string) {
    const expectedKey = this.configService.get('N8N_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid API key');
    }
  }

  @Get('unread-messages')
  @ApiOperation({ summary: 'Get all users with unread messages (for n8n)' })
  @ApiResponse({ status: 200, description: 'Users with unread messages' })
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  async getUsersWithUnreadMessages(
    @Headers('x-api-key') apiKey: string,
    @Query('sinceMinutes') sinceMinutes?: number,
  ) {
    this.verifyApiKey(apiKey);

    const since = new Date(Date.now() - (sinceMinutes || 60) * 60 * 1000);

    // Get all active users
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, email: true, role: true },
    });

    const usersWithUnread = [];

    for (const user of users) {
      const result = await this.chatService.getUnreadMessagesCount(
        user.id,
        user.role as any,
        sinceMinutes || 60,
      );

      if (result.count > 0) {
        usersWithUnread.push({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          unreadCount: result.count,
          recentMessages: result.messages,
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      totalUsersWithUnread: usersWithUnread.length,
      users: usersWithUnread,
    };
  }

  @Post('send-reminder')
  @ApiOperation({ summary: 'Send reminder notification to user via WebSocket' })
  @ApiResponse({ status: 200, description: 'Reminder sent' })
  @ApiHeader({ name: 'x-api-key', description: 'n8n API key' })
  async sendReminder(
    @Headers('x-api-key') apiKey: string,
    @Query('userId') userId: string,
    @Query('message') message?: string,
  ) {
    this.verifyApiKey(apiKey);

    if (!userId) {
      return { success: false, error: 'userId is required' };
    }

    // Get user's unread count
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const unreadData = await this.chatService.getUnreadMessagesCount(
      user.id,
      user.role as any,
      60,
    );

    // Send WebSocket notification
    this.chatGateway.emitToUser(userId, 'reminder:unread', {
      count: unreadData.count,
      message: message || `You have ${unreadData.count} unread message(s)`,
      messages: unreadData.messages,
    });

    return {
      success: true,
      userId,
      unreadCount: unreadData.count,
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for n8n webhook' })
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'chat-n8n-webhook',
    };
  }
}
