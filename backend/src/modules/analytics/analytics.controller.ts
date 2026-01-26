import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@Roles(UserRole.ADMIN) // Only Admin can access analytics
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get overview statistics' })
  getOverview() {
    return this.analyticsService.getOverviewStats();
  }

  @Get('projects')
  @ApiOperation({ summary: 'Get project statistics' })
  getProjectStats() {
    return this.analyticsService.getProjectStats();
  }

  @Get('fiverr-accounts')
  @ApiOperation({ summary: 'Get Fiverr account statistics' })
  getFiverrAccountStats() {
    return this.analyticsService.getFiverrAccountStats();
  }

  @Get('team')
  @ApiOperation({ summary: 'Get team performance statistics' })
  getTeamStats() {
    return this.analyticsService.getTeamStats();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent activity' })
  getRecentActivity(@Query('limit') limit?: string) {
    return this.analyticsService.getRecentActivity(limit ? parseInt(limit, 10) : 20);
  }

  @Get('idle-projects')
  @ApiOperation({ summary: 'Get idle/stalled projects' })
  getIdleProjects(@Query('days') days?: string) {
    return this.analyticsService.getIdleProjects(days ? parseInt(days, 10) : 7);
  }

  @Get('weekly-summary')
  @ApiOperation({ summary: 'Get weekly summary' })
  getWeeklySummary() {
    return this.analyticsService.getWeeklySummary();
  }
}
