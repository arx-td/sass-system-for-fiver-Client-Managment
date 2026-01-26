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
import { User, UserRole } from '@prisma/client';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  QueryProjectsDto,
  AssignTeamLeadDto,
  AttachDesignerDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';

@ApiTags('projects')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new project (Admin only)' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  async create(
    @Body() createDto: CreateProjectDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.create(createDto, userId);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Get all projects (role-filtered)' })
  @ApiResponse({ status: 200, description: 'List of projects' })
  async findAll(@Query() query: QueryProjectsDto, @CurrentUser() user: User) {
    console.log('[PROJECTS CONTROLLER] User from token:', { id: user.id, role: user.role, name: (user as any).name });
    return this.projectsService.findAll(query, user.role, user.id);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get project statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Project statistics' })
  async getStats(@Query('fiverrAccountId') fiverrAccountId?: string) {
    return this.projectsService.getStats(fiverrAccountId);
  }

  @Get('manager-dashboard')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Get manager dashboard data' })
  @ApiResponse({ status: 200, description: 'Manager dashboard data' })
  async getManagerDashboard(@CurrentUser('id') userId: string) {
    return this.projectsService.getManagerDashboard(userId);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
    UserRole.DESIGNER,
  )
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiResponse({ status: 200, description: 'Project details' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.projectsService.findOne(id, user.role);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update project (Admin/Manager)' })
  @ApiResponse({ status: 200, description: 'Project updated' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProjectDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.update(id, updateDto, user.role);
  }

  @Post(':id/assign-team-lead')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Assign Team Lead to project' })
  @ApiResponse({ status: 200, description: 'Team Lead assigned' })
  async assignTeamLead(
    @Param('id') id: string,
    @Body() assignDto: AssignTeamLeadDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.assignTeamLead(id, assignDto, userId);
  }

  @Post(':id/attach-designer')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Attach Designer to project (Admin only)' })
  @ApiResponse({ status: 200, description: 'Designer attached' })
  async attachDesigner(
    @Param('id') id: string,
    @Body() attachDto: AttachDesignerDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.attachDesigner(id, attachDto, userId);
  }

  @Post(':id/mark-delivered')
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Mark project as delivered (Team Lead only)' })
  @ApiResponse({ status: 200, description: 'Project marked as delivered' })
  async markAsDelivered(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.markAsDelivered(id, userId);
  }

  @Post(':id/mark-completed')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Mark project as completed (Admin/Manager)' })
  @ApiResponse({ status: 200, description: 'Project marked as completed' })
  async markAsCompleted(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.markAsCompleted(id, user.role, user.id);
  }

  @Post(':id/send-to-client')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Send project to client for review (Admin/Manager)' })
  @ApiResponse({ status: 200, description: 'Project sent to client' })
  async sendToClient(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.sendToClient(id, user.role, user.id);
  }

  @Post(':id/client-requests-changes')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Mark that client requested changes (Admin/Manager)' })
  @ApiResponse({ status: 200, description: 'Project status updated' })
  async clientRequestsChanges(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.clientRequestsChanges(id, user.role, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete project (Admin only)' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async delete(@Param('id') id: string) {
    return this.projectsService.delete(id);
  }
}
