import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Track } from './entity/track.entity';
import { TrackService } from './tracks.service';
@Module({
  imports: [TypeOrmModule.forFeature([Track])],
  providers: [TrackService],
  exports: [TrackService],
})
export class TrackModule {}
