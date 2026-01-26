import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTaskDto, UpdateTaskDto, QueryTasksDto, SubmitTaskDto, RejectTaskDto } from './dto';
import { TaskStatus, UserRole, Prisma, Task } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(projectId: string, dto: CreateTaskDto, userId: string) {
    // Verify project exists and user is the Team Lead
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.teamLeadId !== userId) {
      throw new ForbiddenException('Only the assigned Team Lead can create tasks');
    }

    // Verify assigned developer exists and has Developer role
    const developer = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
    });

    if (!developer || developer.role !== UserRole.DEVELOPER) {
      throw new BadRequestException('Invalid developer ID');
    }

    // Get team lead name for notification
    const teamLead = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const task = await this.prisma.task.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        assignedToId: dto.assignedToId,
        assignedById: userId,
        priority: dto.priority ?? 0,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        attachments: dto.attachments ? (dto.attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: TaskStatus.ASSIGNED,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Send notification to developer
    await this.notificationsService.notifyTaskAssigned(
      task.id,
      task.title,
      project.internalName,
      dto.assignedToId,
      teamLead?.name || 'Team Lead',
    );

    return task;
  }

  async findAllByProject(projectId: string, query: QueryTasksDto, userId: string, userRole: UserRole) {
    const { status, assignedToId, page = 1, limit = 50 } = query;

    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check access: Team Lead can see all tasks, Developer can only see their own
    const where: any = { projectId };

    if (userRole === UserRole.DEVELOPER) {
      where.assignedToId = userId;
    } else if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (status) {
      where.status = status;
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          assignedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: UserRole) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            teamLeadId: true,
            stagingLink: true,
            stagingPassword: true,
            clientEmail: true,
            clientUsername: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Developer can only see their own tasks
    if (userRole === UserRole.DEVELOPER && task.assignedToId !== userId) {
      throw new ForbiddenException('You can only view your own tasks');
    }

    return task;
  }

  async update(id: string, dto: UpdateTaskDto, userId: string, userRole: UserRole) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Only Team Lead can update task details
    if (task.project.teamLeadId !== userId) {
      throw new ForbiddenException('Only the Team Lead can update tasks');
    }

    // If reassigning, verify new developer
    if (dto.assignedToId) {
      const developer = await this.prisma.user.findUnique({
        where: { id: dto.assignedToId },
      });

      if (!developer || developer.role !== UserRole.DEVELOPER) {
        throw new BadRequestException('Invalid developer ID');
      }
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        assignedToId: dto.assignedToId,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async submit(id: string, dto: SubmitTaskDto, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            teamLeadId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Only assigned developer can submit
    if (task.assignedToId !== userId) {
      throw new ForbiddenException('Only the assigned developer can submit this task');
    }

    // Can only submit if status is ASSIGNED or IN_PROGRESS or REJECTED
    const validSubmitStatuses: TaskStatus[] = [TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.REJECTED];
    if (!validSubmitStatuses.includes(task.status)) {
      throw new BadRequestException('Task cannot be submitted in current status');
    }

    // Get developer name for notification
    const developer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.SUBMITTED,
        submittedAt: new Date(),
        submissionNote: dto.note || null,
        submissionAttachments: dto.attachments ? (dto.attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Notify team lead about submission
    if (task.project.teamLeadId) {
      await this.notificationsService.notifyTaskSubmitted(
        task.id,
        task.title,
        task.project.internalName,
        task.project.teamLeadId,
        developer?.name || 'Developer',
      );
    }

    return updatedTask;
  }

  async startWork(id: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
            teamLeadId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Only assigned developer can start work
    if (task.assignedToId !== userId) {
      throw new ForbiddenException('Only the assigned developer can start this task');
    }

    // Can only start if status is ASSIGNED or REJECTED
    const validStartStatuses: TaskStatus[] = [TaskStatus.ASSIGNED, TaskStatus.REJECTED];
    if (!validStartStatuses.includes(task.status)) {
      throw new BadRequestException('Task cannot be started in current status');
    }

    // Get developer name for notification
    const developer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.IN_PROGRESS,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Notify team lead that developer started the task
    if (task.project.teamLeadId) {
      await this.notificationsService.notifyTaskStarted(
        task.id,
        task.title,
        task.project.internalName,
        task.project.teamLeadId,
        developer?.name || 'Developer',
      );
    }

    return updatedTask;
  }

  async approve(id: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Only Team Lead can approve
    if (task.project.teamLeadId !== userId) {
      throw new ForbiddenException('Only the Team Lead can approve tasks');
    }

    // Can only approve if submitted
    if (task.status !== TaskStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted tasks can be approved');
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.APPROVED,
        approvedAt: new Date(),
      },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Notify developer about approval
    await this.notificationsService.notifyTaskApproved(
      task.id,
      task.title,
      task.assignedToId,
    );

    // Check if all tasks in the project are now approved
    const projectTasks = await this.prisma.task.findMany({
      where: { projectId: task.projectId },
      select: { status: true },
    });

    const allTasksApproved = projectTasks.length > 0 &&
      projectTasks.every((t) => t.status === TaskStatus.APPROVED);

    // If all tasks are approved, update project status to REVIEW
    if (allTasksApproved) {
      await this.prisma.project.update({
        where: { id: task.projectId },
        data: { status: 'REVIEW' },
      });
    }

    return updatedTask;
  }

  async reject(id: string, dto: RejectTaskDto, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Only Team Lead can reject
    if (task.project.teamLeadId !== userId) {
      throw new ForbiddenException('Only the Team Lead can reject tasks');
    }

    // Can only reject if submitted
    if (task.status !== TaskStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted tasks can be rejected');
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.REJECTED,
        rejectionNote: dto.note || null,
        rejectionAttachments: dto.attachments ? (dto.attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        project: {
          select: {
            id: true,
            internalName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Notify developer about rejection
    await this.notificationsService.notifyTaskRejected(
      task.id,
      task.title,
      task.assignedToId,
    );

    return updatedTask;
  }

  async delete(id: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Only Team Lead can delete
    if (task.project.teamLeadId !== userId) {
      throw new ForbiddenException('Only the Team Lead can delete tasks');
    }

    // Cannot delete approved tasks
    if (task.status === TaskStatus.APPROVED) {
      throw new BadRequestException('Cannot delete approved tasks');
    }

    return this.prisma.task.delete({
      where: { id },
    });
  }

  async getTaskStats(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const stats = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    });

    const result = {
      total: 0,
      assigned: 0,
      inProgress: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
    };

    stats.forEach((stat) => {
      result.total += stat._count;
      switch (stat.status) {
        case TaskStatus.ASSIGNED:
          result.assigned = stat._count;
          break;
        case TaskStatus.IN_PROGRESS:
          result.inProgress = stat._count;
          break;
        case TaskStatus.SUBMITTED:
          result.submitted = stat._count;
          break;
        case TaskStatus.APPROVED:
          result.approved = stat._count;
          break;
        case TaskStatus.REJECTED:
          result.rejected = stat._count;
          break;
      }
    });

    return result;
  }
}
