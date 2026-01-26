import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, QueryTasksDto, SubmitTaskDto, RejectTaskDto } from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { UserRole } from '@prisma/client';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Create a new task (Team Lead only)' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.create(projectId, dto, userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD, UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Get all tasks for a project' })
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryTasksDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.tasksService.findAllByProject(projectId, query, userId, userRole);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Get task statistics for a project' })
  getStats(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.getTaskStats(projectId, userId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD, UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Get a specific task' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.tasksService.findOne(id, userId, userRole);
  }

  @Patch(':id')
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Update a task (Team Lead only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.tasksService.update(id, dto, userId, userRole);
  }

  @Post(':id/start')
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Start working on a task (Developer only)' })
  startWork(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.startWork(id, userId);
  }

  @Post(':id/submit')
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Submit a task for review (Developer only)' })
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.submit(id, dto, userId);
  }

  @Post(':id/approve')
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Approve a submitted task (Team Lead only)' })
  approve(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.approve(id, userId);
  }

  @Post(':id/reject')
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Reject a submitted task (Team Lead only)' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.reject(id, dto, userId);
  }

  @Delete(':id')
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Delete a task (Team Lead only)' })
  delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.delete(id, userId);
  }
}
