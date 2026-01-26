import { Module } from '@nestjs/common';
import { FiverrAccountsController } from './fiverr-accounts.controller';
import { FiverrAccountsService } from './fiverr-accounts.service';

@Module({
  controllers: [FiverrAccountsController],
  providers: [FiverrAccountsService],
  exports: [FiverrAccountsService],
})
export class FiverrAccountsModule {}
