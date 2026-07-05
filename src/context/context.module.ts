import { Global, Module } from '@nestjs/common';
import { Context } from './context.service';
@Global()
@Module({
  imports: [],
  providers: [Context],
  exports: [Context],
})
export class ContextModule {}
