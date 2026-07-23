import { Injectable } from '@nestjs/common';
import { UUID } from 'crypto';
import { CurriculumService } from '../../curriculum/services/curriculum.service';
import { LessonStatusType } from '../../curriculum';

type CurriculumResponse = {
  title?: string;
  progress?: number;
  units?: {
    id?: UUID;
    title?: string;
    progress?: number;
    lessons?: {
      id?: UUID;

      name?: string;
      questionLength?: number;
      passed?: boolean;
    }[];
  }[];
};

@Injectable()
export class LearningCurriculumService {
  constructor(private readonly curriculum: CurriculumService) {}

  async getCurriculum(
    trackId: UUID,
    schoolId: UUID,
  ): Promise<CurriculumResponse[]> {
    const courses = await this.curriculum.getCourses({
      trackId,
    });

    const units = await this.curriculum.getUnits({
      trackId,
      schoolId,
    });

    const lessons = await this.curriculum.getLessons(
      {
        trackId,
        schoolId,
        status: LessonStatusType.published,
      },
      {
        questions: true,
      },
    );

    /**
     * Group lessons by unit
     */
    const lessonsByUnit = new Map<UUID, typeof lessons>();

    for (const lesson of lessons) {
      const current = lessonsByUnit.get(lesson.unitId) ?? [];

      current.push(lesson);

      lessonsByUnit.set(lesson.unitId, current);
    }

    /**
     * Group units by course
     */
    const unitsByCourse = new Map<UUID, typeof units>();

    for (const unit of units) {
      const current = unitsByCourse.get(unit.courseId) ?? [];

      current.push(unit);

      unitsByCourse.set(unit.courseId, current);
    }

    /**
     * Build final tree
     */
    return courses.map((course) => ({
      title: course.title,
      progress: 0,

      units: (unitsByCourse.get(course.id) ?? [])
        .sort((a, b) => a.index - b.index)
        .map((unit) => ({
          id: unit.id,
          title: unit.title,
          progress: 0,

          lessons: (lessonsByUnit.get(unit.id) ?? [])
            .sort((a, b) => a.index - b.index)
            .map((lesson) => ({
              id: lesson.id,
              name: lesson.title,
              questionLength: lesson.questions?.length ?? 0,
              passed: false,
            })),
        })),
    }));
  }
}
