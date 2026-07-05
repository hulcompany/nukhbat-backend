import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Course } from './entity/course.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { UUID } from 'crypto';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(Course) private readonly repo: Repository<Course>,
  ) {}

  async find(params: FindOptionsWhere<Course>) {
    return await this.repo.find({
      where: {
        title: params.title ? ILike(`%${params.title}%`) : undefined,
        track: params.track,
        trackId: params.trackId,
      },
      relations: { track: true },
    });
  }

  async exists(params: FindOptionsWhere<Course>) {
    return this.repo.exists({ where: params });
  }

}
