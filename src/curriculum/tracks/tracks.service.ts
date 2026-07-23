import { Injectable } from '@nestjs/common';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Track } from './entity/track.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TrackService {
  constructor(
    @InjectRepository(Track) private readonly repo: Repository<Track>,
  ) {}

  async find() {
    return this.repo.find();
  }

  async exists(params: FindOptionsWhere<Track>) {
    return this.repo.exists({ where: params });
  }
}
