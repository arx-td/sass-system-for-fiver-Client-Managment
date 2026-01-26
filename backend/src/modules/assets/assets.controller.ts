import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { RequestAssetDto, SubmitAssetDto, UpdateAssetDto, QueryAssetsDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller()
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  // Designer's asset queue (all assets assigned to them)
  @Get('assets/my-queue')
  @Roles(UserRole.DESIGNER)
  @ApiOperation({ summary: 'Get all assets assigned to current designer' })
  getMyQueue(
    @Query() query: QueryAssetsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.assetsService.findAssignedToDesigner(userId, query);
  }

  @Post('projects/:projectId/assets/request')
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Request a new asset (Team Lead only)' })
  request(
    @Param('projectId') projectId: string,
    @Body() dto: RequestAssetDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.assetsService.request(projectId, dto, userId);
  }

  @Get('projects/:projectId/assets')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD, UserRole.DEVELOPER, UserRole.DESIGNER)
  @ApiOperation({ summary: 'Get all assets for a project' })
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryAssetsDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.assetsService.findAllByProject(projectId, query, userId, userRole);
  }

  @Get('projects/:projectId/assets/stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD, UserRole.DESIGNER)
  @ApiOperation({ summary: 'Get asset statistics for a project' })
  getStats(@Param('projectId') projectId: string) {
    return this.assetsService.getAssetStats(projectId);
  }

  @Get('projects/:projectId/assets/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD, UserRole.DEVELOPER, UserRole.DESIGNER)
  @ApiOperation({ summary: 'Get a specific asset' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.assetsService.findOne(id, userId, userRole);
  }

  @Patch('projects/:projectId/assets/:id')
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Update asset requirements (Team Lead only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.assetsService.update(id, dto, userId);
  }

  @Post('projects/:projectId/assets/:id/start')
  @Roles(UserRole.DESIGNER)
  @ApiOperation({ summary: 'Start working on an asset (Designer only)' })
  startWork(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.assetsService.startWork(id, userId);
  }

  @Post('projects/:projectId/assets/:id/submit')
  @Roles(UserRole.DESIGNER)
  @ApiOperation({ summary: 'Submit an asset (Designer only)' })
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitAssetDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.assetsService.submit(id, dto, userId);
  }

  @Post('projects/:projectId/assets/:id/approve')
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Approve a submitted asset (Team Lead only)' })
  approve(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.assetsService.approve(id, userId);
  }

  @Post('projects/:projectId/assets/:id/reject')
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Reject a submitted asset (Team Lead only)' })
  reject(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.assetsService.reject(id, userId);
  }

  @Delete('projects/:projectId/assets/:id')
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Delete an asset request (Team Lead only)' })
  delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.assetsService.delete(id, userId);
  }
}
