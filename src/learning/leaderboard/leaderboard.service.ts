import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UUID } from 'crypto';
import { BasePaginationDto, BasePaginationModel, SortType } from 'core';
import { Repository } from 'typeorm';
import { StudentProfile } from '../../student/entity/student-profile.entity';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly students: Repository<StudentProfile>,
  ) {}

  async get(params: {
    schoolId: UUID;
    trackId: UUID;
    query: BasePaginationDto;
  }) {
    const skip = params.query.skip ?? 0;
    const limit = params.query.limit ?? 10;
    const [students, totalRecords] = await this.students.findAndCount({
      where: {
        schoolId: params.schoolId,
        trackId: params.trackId,
        active: true,
      },
      relations: { user: true },
      order: {
        xp: params.query.sort ?? SortType.Desc,
        // createdAt: 'ASC',
      },
      skip,
      take: limit,
    });

    return new BasePaginationModel({
      list: students.map((student, index) => ({
        rank: skip + index + 1,
        student,
        xp: student.xp,
      })),
      totalRecords,
      skip,
      limit,
    });
  }
}
