import { Module } from '@nestjs/common';
import { RevisionsController, GlobalRevisionsController } from './revisions.controller';
import { RevisionsService } from './revisions.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [RevisionsController, GlobalRevisionsController],
  providers: [RevisionsService],
  exports: [RevisionsService],
})
export class RevisionsModule {}
