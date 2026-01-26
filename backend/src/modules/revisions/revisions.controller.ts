import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RevisionsService } from './revisions.service';
import { CreateRevisionDto, UpdateRevisionDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';

// Controller for global revision endpoints (not project-specific)
@ApiTags('revisions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('revisions')
export class GlobalRevisionsController {
  constructor(private readonly revisionsService: RevisionsService) {}

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Get pending revisions for Team Lead (needs assignment)' })
  @ApiResponse({ status: 200, description: 'List of pending revisions needing developer assignment' })
  async getPendingRevisions(
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.getPendingRevisionsForTeamLead(user.id);
  }

  @Get('submitted')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Get submitted revisions for Team Lead (needs review)' })
  @ApiResponse({ status: 200, description: 'List of revisions submitted by developers' })
  async getSubmittedRevisions(
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.getSubmittedRevisionsForTeamLead(user.id);
  }

  @Get('completed')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get completed revisions for Manager (needs acceptance)' })
  @ApiResponse({ status: 200, description: 'List of completed revisions pending manager acceptance' })
  async getCompletedRevisions(
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.getCompletedRevisionsForManager(user.id);
  }

  @Get('assigned')
  @Roles(UserRole.ADMIN, UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Get all revisions assigned to developer' })
  @ApiResponse({ status: 200, description: 'List of assigned revisions' })
  async getAssignedRevisions(
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.getAssignedRevisionsForDeveloper(user.id);
  }

  @Get(':revisionId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD, UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Get revision details' })
  @ApiResponse({ status: 200, description: 'Revision details with attachments' })
  async getRevisionDetails(
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.getRevisionDetails(revisionId, user.id, user.role);
  }

  @Get(':revisionId/suggested-developers')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Get suggested developers for revision assignment' })
  @ApiResponse({ status: 200, description: 'List of suggested developers with scores' })
  async getSuggestedDevelopers(
    @Param('revisionId') revisionId: string,
  ) {
    // First get the revision to find its project
    const revision = await this.revisionsService.findRevisionById(revisionId);
    return this.revisionsService.getSuggestedDevelopers(revision.projectId);
  }

  @Post(':revisionId/assign-developer')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Assign a developer to a revision' })
  @ApiResponse({ status: 200, description: 'Developer assigned successfully' })
  async assignDeveloper(
    @Param('revisionId') revisionId: string,
    @Body() body: { developerId: string },
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    // First get the revision to find its project
    const revision = await this.revisionsService.findRevisionById(revisionId);
    return this.revisionsService.assignDeveloper(
      revision.projectId,
      revisionId,
      body.developerId,
      user.id,
      user.role,
    );
  }

  @Post(':revisionId/start')
  @Roles(UserRole.ADMIN, UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Start working on a revision' })
  @ApiResponse({ status: 200, description: 'Revision started' })
  async startRevision(
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.startRevision(revisionId, user.id, user.role);
  }

  @Post(':revisionId/submit')
  @Roles(UserRole.ADMIN, UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Submit revision work with message' })
  @ApiResponse({ status: 200, description: 'Revision submitted for review' })
  async submitRevision(
    @Param('revisionId') revisionId: string,
    @Body() body: { message: string },
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.submitRevision(
      revisionId,
      body.message || '',
      user.id,
      user.role,
    );
  }

  @Post(':revisionId/accept')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Manager accepts a completed revision' })
  @ApiResponse({ status: 200, description: 'Revision accepted by manager' })
  async acceptRevision(
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.managerAcceptRevision(revisionId, user.id, user.role);
  }
}

// Controller for project-specific revision endpoints
@ApiTags('revisions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/revisions')
export class RevisionsController {
  constructor(private readonly revisionsService: RevisionsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new revision request' })
  @ApiResponse({ status: 201, description: 'Revision created' })
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateRevisionDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.create(projectId, dto, user.id, user.role);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
  )
  @ApiOperation({ summary: 'Get all revisions for a project' })
  @ApiResponse({ status: 200, description: 'List of revisions' })
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.findAllByProject(
      projectId,
      user.id,
      user.role,
    );
  }

  @Get(':revisionId')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
  )
  @ApiOperation({ summary: 'Get a specific revision' })
  @ApiResponse({ status: 200, description: 'Revision details' })
  async findOne(
    @Param('projectId') projectId: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.findOne(
      projectId,
      revisionId,
      user.id,
      user.role,
    );
  }

  @Patch(':revisionId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Update a revision' })
  @ApiResponse({ status: 200, description: 'Revision updated' })
  async update(
    @Param('projectId') projectId: string,
    @Param('revisionId') revisionId: string,
    @Body() dto: UpdateRevisionDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.update(
      projectId,
      revisionId,
      dto,
      user.id,
      user.role,
    );
  }

  @Post(':revisionId/complete')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Mark a revision as complete' })
  @ApiResponse({ status: 200, description: 'Revision completed' })
  async complete(
    @Param('projectId') projectId: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.revisionsService.complete(
      projectId,
      revisionId,
      user.id,
      user.role,
    );
  }
}
