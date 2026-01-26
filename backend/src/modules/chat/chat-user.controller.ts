import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ChatService } from './chat.service';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';

@ApiTags('chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat')
export class ChatUserController {
  constructor(private readonly chatService: ChatService) {}

  @Get('recent')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Get recent messages for current user' })
  @ApiResponse({ status: 200, description: 'Recent messages' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentMessages(
    @Query('limit') limit?: number,
    @CurrentUser() user?: { id: string; role: UserRole },
  ) {
    return this.chatService.getRecentMessagesForUser(
      user!.id,
      user!.role,
      limit || 20,
    );
  }

  @Get('unread-count')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Get unread messages count for n8n reminders' })
  @ApiResponse({ status: 200, description: 'Unread count and messages' })
  @ApiQuery({ name: 'sinceMinutes', required: false, type: Number })
  async getUnreadCount(
    @Query('sinceMinutes') sinceMinutes?: number,
    @CurrentUser() user?: { id: string; role: UserRole },
  ) {
    return this.chatService.getUnreadMessagesCount(
      user!.id,
      user!.role,
      sinceMinutes || 60,
    );
  }
}
