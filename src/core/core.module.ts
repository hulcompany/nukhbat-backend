import { Global, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CoreService } from './core.service';
@Global()
@Module({
  imports: [AuthModule, UserModule],
  exports: [CoreService],
  providers: [CoreService],
})
export class CoreModule {}
