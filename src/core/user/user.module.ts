import { Module } from '@nestjs/common';
import { UserService } from './service/user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { UserController } from './user.controller';
import { OtpModule } from '../../otp/otp.module';
import { UserManageController } from './user-manage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User]), OtpModule],
  controllers: [UserController, UserManageController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
