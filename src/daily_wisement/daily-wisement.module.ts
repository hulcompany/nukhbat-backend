import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyWisement } from './entity/daily-wisement.entity';
import { DailyWisementService } from './daily-wisement.service';
import { DailyWisementController } from './daily-wisement.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DailyWisement])],
  controllers: [DailyWisementController],
  providers: [DailyWisementService],
})
export class DailyWisementModule {}
