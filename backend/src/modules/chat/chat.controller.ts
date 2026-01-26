import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags as ApiTagsDecorator } from '@nestjs/swagger';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CreateMessageDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';

@ApiTags('chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Send a chat message' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async createMessage(
    @Param('projectId') projectId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    const message = await this.chatService.createMessage(projectId, dto, user.id, user.role);

    // Broadcast message to all users in the project room via WebSocket
    this.chatGateway.emitToProject(projectId, 'chat:message', message);

    // Send popup notifications to all relevant users
    this.chatGateway.notifyChatMessage(message, projectId);

    return message;
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Get chat messages for a project' })
  @ApiResponse({ status: 200, description: 'List of messages' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMessages(
    @Param('projectId') projectId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: { id: string; role: UserRole },
  ) {
    return this.chatService.getMessages(
      projectId,
      user!.id,
      user!.role,
      page || 1,
      limit || 50,
    );
  }

  @Patch(':messageId')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Edit a chat message (own messages only)' })
  @ApiResponse({ status: 200, description: 'Message updated' })
  async updateMessage(
    @Param('projectId') projectId: string,
    @Param('messageId') messageId: string,
    @Body('message') message: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    const updatedMessage = await this.chatService.updateMessage(
      messageId,
      message,
      user.id,
    );

    // Broadcast update to all users in the project room
    this.chatGateway.emitToProject(projectId, 'chat:message:updated', updatedMessage);

    return updatedMessage;
  }

  @Delete(':messageId')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Delete a chat message (own messages only, Admin can delete any)' })
  @ApiResponse({ status: 200, description: 'Message deleted' })
  async deleteMessage(
    @Param('projectId') projectId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    await this.chatService.deleteMessage(messageId, user.id, user.role);

    // Broadcast deletion to all users in the project room
    this.chatGateway.emitToProject(projectId, 'chat:message:deleted', { messageId });

    return { success: true, messageId };
  }
}
