import { Module } from '@nestjs/common';
import { ImageKitModule } from '../imagekit/imagekit.module';
import { MailModule } from '../mail/mail.module';
import { TranslationModule } from '../translation/translation.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [ImageKitModule, MailModule, TranslationModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
