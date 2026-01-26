import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateSmtpDto } from './dto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSmtpSettings() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'smtp_config' },
    });

    if (!setting) {
      // Return default settings
      return {
        host: '',
        port: 587,
        secure: false,
        auth: { user: '', pass: '' },
        from: '',
      };
    }

    // Mask password for security
    const value = setting.value as any;
    return {
      ...value,
      auth: {
        ...value.auth,
        pass: value.auth?.pass ? '********' : '',
      },
    };
  }

  async updateSmtpSettings(updateDto: UpdateSmtpDto, userId: string) {
    // Check if we need to preserve the existing password
    let finalDto = { ...updateDto };

    if (updateDto.auth?.pass === '********') {
      // Password is masked, preserve the existing one
      const existingSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'smtp_config' },
      });

      if (existingSetting) {
        const existingConfig = existingSetting.value as any;
        finalDto = {
          ...updateDto,
          auth: {
            ...updateDto.auth,
            pass: existingConfig.auth?.pass || '',
          },
        };
      }
    }

    const setting = await this.prisma.systemSetting.upsert({
      where: { key: 'smtp_config' },
      update: {
        value: finalDto as any,
        updatedBy: userId,
      },
      create: {
        key: 'smtp_config',
        value: finalDto as any,
        category: 'SMTP',
        updatedBy: userId,
      },
    });

    return {
      message: 'SMTP settings updated successfully',
      settings: {
        ...finalDto,
        auth: {
          ...finalDto.auth,
          pass: '********',
        },
      },
    };
  }

  async testSmtpSettings(testEmail: string) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'smtp_config' },
    });

    if (!setting) {
      throw new NotFoundException('SMTP settings not configured. Please save SMTP settings first.');
    }

    const smtpConfig = setting.value as any;

    if (!smtpConfig.host || !smtpConfig.auth?.user || !smtpConfig.auth?.pass) {
      throw new BadRequestException('SMTP settings are incomplete. Please configure host, username, and password.');
    }

    try {
      // Create transporter with saved SMTP settings
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port || 587,
        secure: smtpConfig.secure || false,
        auth: {
          user: smtpConfig.auth.user,
          pass: smtpConfig.auth.pass,
        },
      });

      // Send test email
      await transporter.sendMail({
        from: smtpConfig.from || smtpConfig.auth.user,
        to: testEmail,
        subject: 'CodeReve - SMTP Test Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0f172a;">SMTP Configuration Test</h2>
            <p>This is a test email from CodeReve Management System.</p>
            <p>If you received this email, your SMTP configuration is working correctly!</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #64748b; font-size: 12px;">
              This email was sent from CodeReve Management System.
            </p>
          </div>
        `,
      });

      return {
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
      };
    } catch (error) {
      console.error('SMTP Test Error:', error);
      throw new BadRequestException(
        `Failed to send test email: ${error.message || 'Unknown error'}. Please check your SMTP settings and make sure you are using an App Password for Gmail.`
      );
    }
  }

  async getGeneralSettings() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'general_config' },
    });

    if (!setting) {
      return {
        companyName: 'CodeReve',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        notificationsEnabled: true,
      };
    }

    return setting.value;
  }

  async updateGeneralSettings(data: Record<string, any>, userId: string) {
    const setting = await this.prisma.systemSetting.upsert({
      where: { key: 'general_config' },
      update: {
        value: data,
        updatedBy: userId,
      },
      create: {
        key: 'general_config',
        value: data,
        category: 'GENERAL',
        updatedBy: userId,
      },
    });

    return {
      message: 'General settings updated successfully',
      settings: setting.value,
    };
  }

  async getN8nSettings() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'n8n_config' },
    });

    if (!setting) {
      return {
        enabled: false,
        webhookUrl: '',
        apiKey: '',
      };
    }

    // Mask API key
    const value = setting.value as any;
    return {
      ...value,
      apiKey: value.apiKey ? '********' : '',
    };
  }

  async updateN8nSettings(data: Record<string, any>, userId: string) {
    const setting = await this.prisma.systemSetting.upsert({
      where: { key: 'n8n_config' },
      update: {
        value: data,
        updatedBy: userId,
      },
      create: {
        key: 'n8n_config',
        value: data,
        category: 'N8N',
        updatedBy: userId,
      },
    });

    return {
      message: 'n8n settings updated successfully',
    };
  }

  // =============================================
  // NOTIFICATION SETTINGS
  // =============================================

  async getNotificationSettings() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'notification_config' },
    });

    if (!setting) {
      // Return default settings
      return {
        soundEnabled: true,
        soundUrl: '', // Empty = use built-in Web Audio chime
        soundVolume: 0.5,
        emailNotificationsEnabled: false,
        browserNotificationsEnabled: true,
        // Per-role sound overrides (optional)
        roleSounds: {
          ADMIN: null,
          MANAGER: null,
          TEAM_LEAD: null,
          DEVELOPER: null,
          DESIGNER: null,
        },
        // Notification types enabled/disabled
        notificationTypes: {
          task_assigned: true,
          task_submitted: true,
          task_approved: true,
          task_rejected: true,
          task_started: true,
          asset_requested: true,
          asset_submitted: true,
          asset_approved: true,
          asset_rejected: true,
          project_assigned: true,
          project_status_changed: true,
          revision_created: true,
          revision_completed: true,
          requirements_approved: true,
          chat_message: true,
          user_accepted_invite: true,
        },
      };
    }

    return setting.value;
  }

  async updateNotificationSettings(data: Record<string, any>, userId: string) {
    const setting = await this.prisma.systemSetting.upsert({
      where: { key: 'notification_config' },
      update: {
        value: data,
        updatedBy: userId,
      },
      create: {
        key: 'notification_config',
        value: data,
        category: 'NOTIFICATIONS',
        updatedBy: userId,
      },
    });

    return {
      message: 'Notification settings updated successfully',
      settings: setting.value,
    };
  }

  // Get notification settings for API (public endpoint for all authenticated users)
  async getPublicNotificationSettings() {
    const settings = await this.getNotificationSettings() as any;

    return {
      soundEnabled: settings.soundEnabled,
      soundUrl: settings.soundUrl,
      soundVolume: settings.soundVolume,
      browserNotificationsEnabled: settings.browserNotificationsEnabled,
      roleSounds: settings.roleSounds,
    };
  }
}
