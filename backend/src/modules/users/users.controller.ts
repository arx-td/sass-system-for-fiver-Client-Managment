import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, QueryUsersDto, AdminResetPasswordDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('invite')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Invite a new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'User invited successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async invite(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.create(createUserDto, userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Get all users (Admin/Manager/Team Lead with role filter)' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async findAll(@Query() query: QueryUsersDto, @CurrentUser('role') userRole: UserRole) {
    // Non-admins can only query specific roles they need
    if (userRole === UserRole.MANAGER && query.role !== UserRole.TEAM_LEAD) {
      query.role = UserRole.TEAM_LEAD; // Managers can only see Team Leads
    }
    if (userRole === UserRole.TEAM_LEAD && query.role !== UserRole.DEVELOPER && query.role !== UserRole.DESIGNER) {
      query.role = UserRole.DEVELOPER; // Team Leads can only see Developers and Designers
    }
    return this.usersService.findAll(query);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'User statistics' })
  async getStats() {
    return this.usersService.getStats();
  }

  @Get('by-role/:role')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Get users by role' })
  @ApiResponse({ status: 200, description: 'List of users by role' })
  async findByRole(@Param('role') role: UserRole) {
    return this.usersService.findByRole(role);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usersService.update(id, updateUserDto, currentUserId);
  }

  @Post(':id/suspend')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Suspend user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User suspended' })
  @ApiResponse({ status: 403, description: 'Cannot suspend admin or self' })
  async suspend(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usersService.suspend(id, currentUserId);
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User activated' })
  async activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }

  @Post(':id/resend-invitation')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resend invitation email (Admin only)' })
  @ApiResponse({ status: 200, description: 'Invitation resent' })
  @ApiResponse({ status: 403, description: 'User already activated' })
  async resendInvitation(@Param('id') id: string) {
    return this.usersService.resendInvitation(id);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reset user password (Admin only)' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usersService.adminResetPassword(id, dto, currentUserId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 403, description: 'Cannot delete admin or self' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usersService.delete(id, currentUserId);
  }
}
