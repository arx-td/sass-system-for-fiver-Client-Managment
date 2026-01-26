import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectStatus, TaskStatus, AssetStatus, UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getOverviewStats() {
    const [
      totalProjects,
      activeProjects,
      completedProjects,
      totalUsers,
      activeUsers,
      totalTasks,
      completedTasks,
      totalAssets,
      approvedAssets,
    ] = await Promise.all([
      this.prisma.project.count(),
      this.prisma.project.count({
        where: { status: { in: [ProjectStatus.IN_PROGRESS, ProjectStatus.REVIEW] } },
      }),
      this.prisma.project.count({
        where: { status: ProjectStatus.COMPLETED },
      }),
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { status: UserStatus.ACTIVE },
      }),
      this.prisma.task.count(),
      this.prisma.task.count({
        where: { status: TaskStatus.APPROVED },
      }),
      this.prisma.designAsset.count(),
      this.prisma.designAsset.count({
        where: { status: AssetStatus.APPROVED },
      }),
    ]);

    return {
      projects: {
        total: totalProjects,
        active: activeProjects,
        completed: completedProjects,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      assets: {
        total: totalAssets,
        approved: approvedAssets,
      },
    };
  }

  async getProjectStats() {
    const statusCounts = await this.prisma.project.groupBy({
      by: ['status'],
      _count: true,
    });

    const complexityCounts = await this.prisma.project.groupBy({
      by: ['complexity'],
      _count: true,
    });

    const priorityCounts = await this.prisma.project.groupBy({
      by: ['priority'],
      _count: true,
    });

    // Projects created per month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const projectsByMonth = await this.prisma.project.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: sixMonthsAgo },
      },
      _count: true,
    });

    return {
      byStatus: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byComplexity: complexityCounts.reduce((acc, item) => {
        acc[item.complexity] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byPriority: priorityCounts.reduce((acc, item) => {
        acc[item.priority] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async getFiverrAccountStats() {
    const accounts = await this.prisma.fiverrAccount.findMany({
      include: {
        _count: {
          select: { projects: true },
        },
        projects: {
          select: {
            status: true,
          },
        },
      },
    });

    return accounts.map((account) => ({
      id: account.id,
      name: account.accountName,
      isActive: account.isActive,
      totalProjects: account._count.projects,
      activeProjects: account.projects.filter(
        (p) => p.status === ProjectStatus.IN_PROGRESS || p.status === ProjectStatus.REVIEW
      ).length,
      completedProjects: account.projects.filter(
        (p) => p.status === ProjectStatus.COMPLETED
      ).length,
    }));
  }

  async getTeamStats() {
    const users = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIVE },
      include: {
        _count: {
          select: {
            managedProjects: true,
            ledProjects: true,
            designedProjects: true,
            assignedTasks: true,
            uploadedAssets: true,
          },
        },
        assignedTasks: {
          select: { status: true },
        },
        uploadedAssets: {
          select: { status: true },
        },
      },
    });

    const byRole = users.reduce((acc, user) => {
      if (!acc[user.role]) {
        acc[user.role] = 0;
      }
      acc[user.role]++;
      return acc;
    }, {} as Record<string, number>);

    const teamMembers = users.map((user) => {
      const completedTasks = user.assignedTasks.filter(
        (t) => t.status === TaskStatus.APPROVED
      ).length;
      const approvedAssets = user.uploadedAssets.filter(
        (a) => a.status === AssetStatus.APPROVED
      ).length;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        managedProjects: user._count.managedProjects,
        ledProjects: user._count.ledProjects,
        designedProjects: user._count.designedProjects,
        totalTasks: user._count.assignedTasks,
        completedTasks,
        taskCompletionRate:
          user._count.assignedTasks > 0
            ? Math.round((completedTasks / user._count.assignedTasks) * 100)
            : 0,
        totalAssets: user._count.uploadedAssets,
        approvedAssets,
      };
    });

    return {
      byRole,
      members: teamMembers,
    };
  }

  async getRecentActivity(limit = 20) {
    const [recentProjects, recentTasks, recentAssets] = await Promise.all([
      this.prisma.project.findMany({
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          internalName: true,
          status: true,
          updatedAt: true,
        },
      }),
      this.prisma.task.findMany({
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          assignedTo: {
            select: { name: true },
          },
        },
      }),
      this.prisma.designAsset.findMany({
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true,
          uploadedBy: {
            select: { name: true },
          },
        },
      }),
    ]);

    // Combine and sort by date
    const activities = [
      ...recentProjects.map((p) => ({
        type: 'project',
        id: p.id,
        title: p.internalName,
        status: p.status,
        timestamp: p.updatedAt,
      })),
      ...recentTasks.map((t) => ({
        type: 'task',
        id: t.id,
        title: t.title,
        status: t.status,
        user: t.assignedTo?.name,
        timestamp: t.updatedAt,
      })),
      ...recentAssets.map((a) => ({
        type: 'asset',
        id: a.id,
        title: a.name,
        status: a.status,
        user: a.uploadedBy?.name,
        timestamp: a.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return activities;
  }

  async getIdleProjects(daysIdle = 7) {
    const idleDate = new Date();
    idleDate.setDate(idleDate.getDate() - daysIdle);

    return this.prisma.project.findMany({
      where: {
        status: { in: [ProjectStatus.IN_PROGRESS, ProjectStatus.REVIEW] },
        updatedAt: { lt: idleDate },
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        teamLead: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async getWeeklySummary() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [
      newProjects,
      completedProjects,
      newTasks,
      completedTasks,
      newAssets,
      approvedAssets,
    ] = await Promise.all([
      this.prisma.project.count({
        where: { createdAt: { gte: oneWeekAgo } },
      }),
      this.prisma.project.count({
        where: {
          status: ProjectStatus.COMPLETED,
          updatedAt: { gte: oneWeekAgo },
        },
      }),
      this.prisma.task.count({
        where: { createdAt: { gte: oneWeekAgo } },
      }),
      this.prisma.task.count({
        where: {
          status: TaskStatus.APPROVED,
          approvedAt: { gte: oneWeekAgo },
        },
      }),
      this.prisma.designAsset.count({
        where: { createdAt: { gte: oneWeekAgo } },
      }),
      this.prisma.designAsset.count({
        where: {
          status: AssetStatus.APPROVED,
          approvedAt: { gte: oneWeekAgo },
        },
      }),
    ]);

    return {
      period: {
        start: oneWeekAgo.toISOString(),
        end: new Date().toISOString(),
      },
      projects: {
        new: newProjects,
        completed: completedProjects,
      },
      tasks: {
        new: newTasks,
        completed: completedTasks,
      },
      assets: {
        new: newAssets,
        approved: approvedAssets,
      },
    };
  }
}
