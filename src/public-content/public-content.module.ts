import { Module } from '@nestjs/common';
import { FaqModule } from './faqs/faq.module';
import { InfoModule } from './info/info.module';

@Module({
  imports: [FaqModule, InfoModule],
})
export class PublicContentModule {}
