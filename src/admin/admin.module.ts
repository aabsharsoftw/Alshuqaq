import { Module } from '@nestjs/common';
import { EnquiriesModule } from '../enquiries/enquiries.module';
import { ListingsModule } from '../listings/listings.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [ListingsModule, UsersModule, EnquiriesModule],
  controllers: [AdminController],
})
export class AdminModule {}
