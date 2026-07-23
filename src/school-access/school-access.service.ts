import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { UUID } from 'crypto';

import { ErrorsRecord } from 'core';
import { SchoolAccess } from './entity/school-access.entity';
import { SchoolAccessErrorCodes } from './errors';
import { SchoolAccessDto } from './dto/school-access.dto';
import { School } from '../school/entity/school.entity';
import { Track } from '../curriculum/tracks/entity/track.entity';

@Injectable()
export class SchoolAccessService {
  constructor(
    @InjectRepository(SchoolAccess)
    private readonly repo: Repository<SchoolAccess>,

    private readonly ds: DataSource,
  ) {}

  // The default school implicitly has access to every track, so granting /
  // revoking against it is meaningless — reject it. There are no FK columns
  // on this table, so we verify the track and school exist here rather than
  // relying on the DB to reject dangling ids.
  async grantAccess(params: SchoolAccessDto) {
    const trackExists = await this.ds
      .getRepository(Track)
      .exists({ where: { id: params.trackId } });
    if (!trackExists) {
      throw new NotFoundException('Track Not Found');
    }

    const school = await this.ds
      .getRepository(School)
      .findOne({ where: { id: params.schoolId } });
    if (!school) {
      throw new NotFoundException('School Not Found');
    }
    if (school.default) {
      throw new BadRequestException('Default School has access to all tracks');
    }

    const exists = await this.repo.exists({
      where: {
        schoolId: params.schoolId,
        trackId: params.trackId,
      },
    });
    if (exists) {
      throw new BadRequestException('School already has access to this track');
    }

    await this.repo.insert({
      schoolId: params.schoolId,
      trackId: params.trackId,
    });
  }

  async revokeAccess(params: SchoolAccessDto) {
    const school = await this.ds
      .getRepository(School)
      .findOne({ where: { id: params.schoolId } });
    if (!school) {
      throw new NotFoundException('School Not Found');
    }
    if (school.default) {
      throw new BadRequestException('Default School has access to all tracks');
    }

    const result = await this.repo.delete({
      schoolId: params.schoolId,
      trackId: params.trackId,
    });

    if (result.affected === 0) {
      throw new BadRequestException(
        'School does not have access to this track',
      );
    }
  }

  // Tracks a school may use — joins through the `track` relation.
  async getSchoolAccessableTracks(schoolId: UUID) {
    return (
      await this.repo.find({
        where: { schoolId },
        relations: { track: true },
      })
    ).map((e) => e.track);
  }

  private toIds(id: UUID | UUID[]) {
    return [...new Set(Array.isArray(id) ? id : [id])];
  }

  private async assertTracksAllowed(schoolId: UUID, trackIds: UUID[]) {
    const ids = [...new Set(trackIds)];

    if (!ids.length) return;

    const count = await this.repo.count({
      where: {
        schoolId,
        trackId: In(ids),
      },
    });

    if (count !== ids.length) {
      throw new ForbiddenException(
        ErrorsRecord.getError(SchoolAccessErrorCodes.SCHOOL_ACCESS_1),
      );
    }
  }

  async assertTrackAccess(schoolId: UUID, trackId: UUID | UUID[]) {
    await this.assertTracksAllowed(schoolId, this.toIds(trackId));
  }

  async assertCourseAccess(schoolId: UUID, courseId: UUID | UUID[]) {
    const ids = this.toIds(courseId);

    const rows = await this.ds.query(
      `
      SELECT id, "trackId"
      FROM course
      WHERE id = ANY($1)
      `,
      [ids],
    );

    if (rows.length !== ids.length) {
      throw new NotFoundException('Course Not Found');
    }

    await this.assertTracksAllowed(
      schoolId,
      rows.map((x) => x.trackId),
    );
  }

  async assertUnitAccess(schoolId: UUID, unitId: UUID | UUID[]) {
    const ids = this.toIds(unitId);

    const rows = await this.ds.query(
      `
      SELECT 
        u.id,
        c."trackId"
      FROM unit u
      JOIN course c
        ON c.id = u."courseId"
      WHERE u.id = ANY($1)
      `,
      [ids],
    );

    if (rows.length !== ids.length) {
      throw new NotFoundException('Unit Not Found');
    }

    await this.assertTracksAllowed(
      schoolId,
      rows.map((x) => x.trackId),
    );
  }

  async assertLessonAccess(schoolId: UUID, lessonId: UUID | UUID[]) {
    const ids = this.toIds(lessonId);

    const rows = await this.ds.query(
      `
      SELECT
        l.id,
        c."trackId"
      FROM lesson l
      JOIN unit u
        ON u.id = l."unitId"
      JOIN course c
        ON c.id = u."courseId"
      WHERE l.id = ANY($1)
      `,
      [ids],
    );

    if (rows.length !== ids.length) {
      throw new NotFoundException('Lesson Not Found');
    }

    await this.assertTracksAllowed(
      schoolId,
      rows.map((x) => x.trackId),
    );
  }

  async assertQuestionAccess(schoolId: UUID, questionId: UUID | UUID[]) {
    const ids = this.toIds(questionId);

    const rows = await this.ds.query(
      `
      SELECT
        q.id,
        COALESCE(
          lesson_course."trackId",
          question_course."trackId"
        ) AS "trackId"

      FROM question q

      LEFT JOIN lesson l
        ON l.id = q."lessonId"

      LEFT JOIN unit u
        ON u.id = l."unitId"

      LEFT JOIN course lesson_course
        ON lesson_course.id = u."courseId"

      LEFT JOIN course question_course
        ON question_course.id = q."courseId"

      WHERE q.id = ANY($1)
      `,
      [ids],
    );

    if (rows.length !== ids.length) {
      throw new NotFoundException('Question Not Found');
    }

    await this.assertTracksAllowed(
      schoolId,
      rows.map((x) => x.trackId).filter(Boolean),
    );
  }

  async canAccessTrack(schoolId: UUID, trackId: UUID) {
    const count = await this.repo.count({
      where: {
        schoolId,
        trackId,
      },
    });

    return count > 0;
  }
}
