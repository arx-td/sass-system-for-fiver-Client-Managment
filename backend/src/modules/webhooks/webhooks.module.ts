import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
