import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppDataSource } from './database/ds';
import { RedisModule } from './redis.module';
import { OtpModule } from './otp/otp.module';
import { FileModule } from './file/file.module';
import { CoreModule } from './core/core.module';
import { SchoolModule } from './school/school.module';
import { ContextModule } from './context';
import { LearningModule } from './learning/learning.module';
import { PublicContentModule } from './public-content/public-content.module';
import { DailyWisementModule } from './daily_wisement/daily-wisement.module';
import { StudentModule } from './student/student.module';
import { SubscriptionModule } from './subscription/subscription.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => AppDataSource.options,
    }),
    RedisModule,
    ContextModule,
    OtpModule,
    FileModule,
    CoreModule,
    LearningModule,
    SchoolModule,
    StudentModule,
    SubscriptionModule,
    PublicContentModule,
    DailyWisementModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
  ],
})
export class AppModule {}
