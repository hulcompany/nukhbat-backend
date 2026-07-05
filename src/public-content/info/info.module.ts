import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfoController } from './info.controller';
import { InfoService } from './info.service';
import { Info } from './entity/info.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Info])],
  controllers: [InfoController],
  providers: [InfoService],
})
export class InfoModule {}
