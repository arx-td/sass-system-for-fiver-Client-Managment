import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FiverrAccountsModule } from './modules/fiverr-accounts/fiverr-accounts.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuditModule } from './modules/audit/audit.module';
import { RequirementsModule } from './modules/requirements/requirements.module';
import { RevisionsModule } from './modules/revisions/revisions.module';
import { ChatModule } from './modules/chat/chat.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AssetsModule } from './modules/assets/assets.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { UploadModule } from './modules/upload/upload.module';
import { ProjectReviewsModule } from './modules/project-reviews/project-reviews.module';
// import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    UsersModule,
    FiverrAccountsModule,
    ProjectsModule,
    SettingsModule,
    AuditModule,
    RequirementsModule,
    RevisionsModule,
    ChatModule,
    TasksModule,
    AssetsModule,
    NotificationsModule,
    AnalyticsModule,
    WebhooksModule,
    UploadModule,
    ProjectReviewsModule,
    // EmailModule,
  ],
  controllers: [],
  providers: [
    // Global JWT Auth Guard - protects all routes by default
    // Use @Public() decorator to make routes public
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Roles Guard - enforces role-based access
    // Use @Roles() decorator to specify required roles
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
