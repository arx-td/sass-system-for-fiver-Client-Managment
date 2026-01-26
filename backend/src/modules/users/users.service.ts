import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '@/prisma/prisma.service';
import { UserRole, UserStatus, Prisma } from '@prisma/client';
import { CreateUserDto, UpdateUserDto, QueryUsersDto, AdminResetPasswordDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, invitedById: string) {
    const { email, name, role } = createUserDto;

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Generate temporary password and reset token
    const tempPassword = uuidv4().slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 3600000); // 7 days

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        role,
        passwordHash,
        status: UserStatus.INVITED,
        invitedById,
        resetToken,
        resetTokenExpiry,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Send invitation email
    await this.sendInvitationEmail(email, name, resetToken);

    return {
      user,
      message: 'User created successfully. Invitation email has been sent.',
    };
  }

  private async sendInvitationEmail(email: string, name: string, resetToken: string) {
    try {
      console.log(`[EMAIL] Attempting to send invitation email to: ${email}`);

      // Get SMTP settings from database
      const smtpSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'smtp_config' },
      });

      if (!smtpSetting) {
        console.warn('[EMAIL] SMTP not configured. Invitation email not sent for:', email);
        console.log(`[EMAIL] Invitation token for ${email}: ${resetToken}`);
        return;
      }

      const smtpConfig = smtpSetting.value as any;

      console.log(`[EMAIL] SMTP Config found - Host: ${smtpConfig.host}, Port: ${smtpConfig.port}, User: ${smtpConfig.auth?.user}`);

      if (!smtpConfig.host || !smtpConfig.auth?.user || !smtpConfig.auth?.pass) {
        console.warn('[EMAIL] SMTP settings incomplete. Invitation email not sent for:', email);
        console.log(`[EMAIL] Missing: host=${!smtpConfig.host}, user=${!smtpConfig.auth?.user}, pass=${!smtpConfig.auth?.pass}`);
        console.log(`[EMAIL] Invitation token for ${email}: ${resetToken}`);
        return;
      }

      // Check if password is masked (bug where masked password was saved)
      if (smtpConfig.auth.pass === '********') {
        console.error('[EMAIL] SMTP password is masked! Please re-enter the password in Settings.');
        console.log(`[EMAIL] Invitation token for ${email}: ${resetToken}`);
        return;
      }

      // Create transporter with timeout settings
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port || 587,
        secure: smtpConfig.secure || false,
        auth: {
          user: smtpConfig.auth.user,
          pass: smtpConfig.auth.pass,
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      // Get frontend URL from environment or use default
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetPasswordLink = `${frontendUrl}/reset-password?token=${resetToken}`;

      console.log(`[EMAIL] Reset link: ${resetPasswordLink}`);

      // Send invitation email
      await transporter.sendMail({
        from: smtpConfig.from || smtpConfig.auth.user,
        to: email,
        subject: 'Welcome to CodeReve - You\'ve Been Invited!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #0f172a; margin: 0;">CodeReve</h1>
              <p style="color: #64748b; margin: 5px 0;">Management System</p>
            </div>

            <h2 style="color: #0f172a;">Welcome, ${name}!</h2>

            <p style="color: #334155; line-height: 1.6;">
              You've been invited to join the CodeReve Management System. To get started,
              please set up your password by clicking the button below.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetPasswordLink}"
                 style="background-color: #0f172a; color: white; padding: 12px 30px;
                        text-decoration: none; border-radius: 6px; display: inline-block;
                        font-weight: 500;">
                Set Up Your Password
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="color: #3b82f6; font-size: 14px; word-break: break-all;">
              ${resetPasswordLink}
            </p>

            <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
              This link will expire in 7 days. If you didn't expect this invitation,
              please ignore this email.
            </p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

            <p style="color: #94a3b8; font-size: 12px; text-align: center;">
              This email was sent from CodeReve Management System.
            </p>
          </div>
        `,
      });

      console.log(`[EMAIL] Invitation email sent successfully to ${email}`);
    } catch (error) {
      console.error('[EMAIL] Failed to send invitation email:', error.message);
      console.error('[EMAIL] Full error:', error);
      console.log(`[EMAIL] Invitation token for ${email}: ${resetToken}`);
    }
  }

  async findAll(query: QueryUsersDto) {
    const { role, status, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          invitedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        invitedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            assignedTasks: true,
            ledProjects: true,
            managedProjects: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByRole(role: UserRole) {
    const select: Prisma.UserSelect = {
      id: true,
      email: true,
      name: true,
      avatar: true,
      role: true,
    };

    // Include tier info for developers
    if (role === UserRole.DEVELOPER) {
      select.tier = true;
      select.completedProjects = true;
      select.averageRating = true;
      select.totalReviews = true;
    }

    return this.prisma.user.findMany({
      where: {
        role,
        status: UserStatus.ACTIVE,
      },
      select,
      orderBy: role === UserRole.DEVELOPER
        ? [{ tier: 'desc' }, { averageRating: 'desc' }, { name: 'asc' }]
        : { name: 'asc' },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent self-role change
    if (id === currentUserId && updateUserDto.role) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async suspend(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('You cannot suspend yourself');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot suspend an admin user');
    }

    const suspendedUser = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.SUSPENDED },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });

    return {
      user: suspendedUser,
      message: 'User has been suspended',
    };
  }

  async activate(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const activatedUser = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });

    return {
      user: activatedUser,
      message: 'User has been activated',
    };
  }

  async resendInvitation(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== UserStatus.INVITED) {
      throw new ForbiddenException('User has already accepted the invitation');
    }

    // Generate new reset token
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 3600000); // 7 days

    await this.prisma.user.update({
      where: { id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send invitation email
    await this.sendInvitationEmail(user.email, user.name, resetToken);

    return {
      message: 'Invitation has been resent',
    };
  }

  async getStats() {
    const [total, byRole, byStatus] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { role: true },
      }),
      this.prisma.user.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    return {
      total,
      byRole: byRole.reduce(
        (acc, curr) => ({ ...acc, [curr.role]: curr._count.role }),
        {},
      ),
      byStatus: byStatus.reduce(
        (acc, curr) => ({ ...acc, [curr.status]: curr._count.status }),
        {},
      ),
    };
  }

  async delete(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('You cannot delete yourself');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot delete an admin user');
    }

    // Delete related records first (cascade delete isn't set up for all relations)
    await this.prisma.$transaction([
      // Delete notifications
      this.prisma.notification.deleteMany({ where: { userId: id } }),
      // Delete audit logs
      this.prisma.auditLog.deleteMany({ where: { userId: id } }),
      // Delete chat messages
      this.prisma.chatMessage.deleteMany({ where: { senderId: id } }),
      // Finally delete the user
      this.prisma.user.delete({ where: { id } }),
    ]);

    return {
      message: 'User has been deleted successfully',
    };
  }

  async adminResetPassword(id: string, dto: AdminResetPasswordDto, currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        // If user was invited, activate them since admin is setting their password
        status: user.status === UserStatus.INVITED ? UserStatus.ACTIVE : user.status,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return {
      message: 'Password has been reset successfully',
    };
  }
}
