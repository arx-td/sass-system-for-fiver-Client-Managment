import { Module } from '@nestjs/common';
import { ProjectReviewsController } from './project-reviews.controller';
import { ProjectReviewsService } from './project-reviews.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectReviewsController],
  providers: [ProjectReviewsService],
  exports: [ProjectReviewsService],
})
export class ProjectReviewsModule {}
