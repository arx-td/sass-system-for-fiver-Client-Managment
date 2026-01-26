import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequirementsService } from './requirements.service';
import { CreateRequirementDto, UpdateRequirementDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';

@ApiTags('requirements')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/requirements')
export class RequirementsController {
  constructor(private readonly requirementsService: RequirementsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new requirement version' })
  @ApiResponse({ status: 201, description: 'Requirement created' })
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateRequirementDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.requirementsService.create(projectId, dto, user.id, user.role);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Get all requirement versions for a project' })
  @ApiResponse({ status: 200, description: 'List of requirement versions' })
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.requirementsService.findAllByProject(
      projectId,
      user.id,
      user.role,
    );
  }

  @Get('latest-approved')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
  )
  @ApiOperation({ summary: 'Get latest approved requirement' })
  @ApiResponse({ status: 200, description: 'Latest approved requirement' })
  async getLatestApproved(@Param('projectId') projectId: string) {
    return this.requirementsService.getLatestApproved(projectId);
  }

  @Get(':version')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.DEVELOPER,
  )
  @ApiOperation({ summary: 'Get a specific requirement version' })
  @ApiResponse({ status: 200, description: 'Requirement details' })
  async findOne(
    @Param('projectId') projectId: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.requirementsService.findByVersion(
      projectId,
      version,
      user.id,
      user.role,
    );
  }

  @Patch(':version')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a requirement version (draft only)' })
  @ApiResponse({ status: 200, description: 'Requirement updated' })
  async update(
    @Param('projectId') projectId: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() dto: UpdateRequirementDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.requirementsService.update(
      projectId,
      version,
      dto,
      user.id,
      user.role,
    );
  }

  @Post(':version/approve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve a requirement version' })
  @ApiResponse({ status: 200, description: 'Requirement approved' })
  async approve(
    @Param('projectId') projectId: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.requirementsService.approve(
      projectId,
      version,
      user.id,
      user.role,
    );
  }
}
