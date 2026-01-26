import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SettingsService } from './settings.service';
import { UpdateSmtpDto, TestSmtpDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';

@ApiTags('settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('smtp')
  @ApiOperation({ summary: 'Get SMTP settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'SMTP configuration' })
  async getSmtpSettings() {
    return this.settingsService.getSmtpSettings();
  }

  @Post('smtp')
  @ApiOperation({ summary: 'Update SMTP settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'SMTP settings updated' })
  async updateSmtpSettings(
    @Body() updateDto: UpdateSmtpDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateSmtpSettings(updateDto, userId);
  }

  @Post('smtp/test')
  @ApiOperation({ summary: 'Test SMTP settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Test email sent' })
  async testSmtpSettings(@Body() testDto: TestSmtpDto) {
    return this.settingsService.testSmtpSettings(testDto.testEmail);
  }

  @Get('general')
  @ApiOperation({ summary: 'Get general settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'General settings' })
  async getGeneralSettings() {
    return this.settingsService.getGeneralSettings();
  }

  @Post('general')
  @ApiOperation({ summary: 'Update general settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'General settings updated' })
  async updateGeneralSettings(
    @Body() data: Record<string, any>,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateGeneralSettings(data, userId);
  }

  @Get('n8n')
  @ApiOperation({ summary: 'Get n8n settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'n8n configuration' })
  async getN8nSettings() {
    return this.settingsService.getN8nSettings();
  }

  @Post('n8n')
  @ApiOperation({ summary: 'Update n8n settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'n8n settings updated' })
  async updateN8nSettings(
    @Body() data: Record<string, any>,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateN8nSettings(data, userId);
  }

  // =============================================
  // NOTIFICATION SETTINGS
  // =============================================

  @Get('notifications')
  @ApiOperation({ summary: 'Get notification settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Notification configuration' })
  async getNotificationSettings() {
    return this.settingsService.getNotificationSettings();
  }

  @Post('notifications')
  @ApiOperation({ summary: 'Update notification settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Notification settings updated' })
  async updateNotificationSettings(
    @Body() data: Record<string, any>,
    @CurrentUser('id') userId: string,
  ) {
    return this.settingsService.updateNotificationSettings(data, userId);
  }

  @Get('notifications/public')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD, UserRole.DEVELOPER, UserRole.DESIGNER)
  @ApiOperation({ summary: 'Get public notification settings (All authenticated users)' })
  @ApiResponse({ status: 200, description: 'Public notification settings' })
  async getPublicNotificationSettings() {
    return this.settingsService.getPublicNotificationSettings();
  }
}
