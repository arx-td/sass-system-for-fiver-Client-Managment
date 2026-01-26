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
import { ProjectReviewsService } from './project-reviews.service';
import { CreateReviewDto, UpdateReviewDto, QueryReviewsDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';

@ApiTags('project-reviews')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('project-reviews')
export class ProjectReviewsController {
  constructor(private readonly reviewsService: ProjectReviewsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a project review for a developer (Admin only)' })
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 409, description: 'Review already exists' })
  async create(
    @Body() createDto: CreateReviewDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.reviewsService.create(createDto, adminId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all project reviews (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of reviews' })
  async findAll(@Query() query: QueryReviewsDto) {
    return this.reviewsService.findAll(query);
  }

  @Get('my-stats')
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Get current developer own tier and stats' })
  @ApiResponse({ status: 200, description: 'Developer statistics' })
  async getMyStats(@CurrentUser('id') userId: string) {
    return this.reviewsService.getDeveloperStats(userId);
  }

  @Get('developers')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Get all developers with tier info' })
  @ApiResponse({ status: 200, description: 'List of developers with tiers' })
  async getAllDevelopersWithTiers() {
    return this.reviewsService.getAllDevelopersWithTiers();
  }

  @Get('developers/:developerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Get developer statistics and tier info' })
  @ApiResponse({ status: 200, description: 'Developer statistics' })
  @ApiResponse({ status: 404, description: 'Developer not found' })
  async getDeveloperStats(@Param('developerId') developerId: string) {
    return this.reviewsService.getDeveloperStats(developerId);
  }

  @Get('developers/:developerId/reviewable-projects')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get projects that can be reviewed for a developer' })
  @ApiResponse({ status: 200, description: 'List of reviewable projects' })
  async getReviewableProjects(@Param('developerId') developerId: string) {
    return this.reviewsService.getReviewableProjects(developerId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a single review by ID' })
  @ApiResponse({ status: 200, description: 'Review details' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a review (Admin only)' })
  @ApiResponse({ status: 200, description: 'Review updated' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateReviewDto) {
    return this.reviewsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a review (Admin only)' })
  @ApiResponse({ status: 200, description: 'Review deleted' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async delete(@Param('id') id: string) {
    return this.reviewsService.delete(id);
  }
}
