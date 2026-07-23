import { Injectable } from '@nestjs/common';
import { UUID } from 'crypto';
import {
  EntityManager,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';
import { CourseService } from '../course/course.service';
import { UnitService } from '../units/unit.service';
import { LessonService } from '../lessons/lessons.service';
import { QuestionService } from '../questions/questions.service';
import {
  AdminQuestionGetDto,
  QuestionGetDto,
} from '../questions/dto/question.dto';
import { Unit } from '../units/entity/unit.entity';
import { Lesson } from '../lessons/entity/lesson.entity';
import { LessonStatusType } from '../lessons/entity/lesson.status.type';
import { TrackService } from '../tracks/tracks.service';
import { Question } from '../questions/entity/questions.entity';

// Read-only content layer. It holds NO request context: every method takes
// explicit filters/scope, and the caller (controller or role facade) is
// responsible for resolving ownership and ids before calling. Keeping it
// context-free lets admin (unscoped), school-owner (school-scoped) and
// student (track-scoped) callers share the same queries — the caller decides
// the scope, and `relations` lets each caller pick the shape it needs.
@Injectable()
export class CurriculumService {
  constructor(
    private readonly courseService: CourseService,
    private readonly unitService: UnitService,
    private readonly lessonService: LessonService,
    private readonly questionService: QuestionService,
    private readonly trackService: TrackService,
  ) {}

  getTracks() {
    return this.trackService.find();
  }

  getCourses(filter: { title?: string; trackId?: UUID }) {
    return this.courseService.find({
      title: filter.title,
      trackId: filter.trackId,
    });
  }

  getUnits(
    filter: {
      schoolId?: UUID;
      title?: string;
      courseId?: UUID;
      trackId?: UUID;
      id?: UUID;
    },
    relations?: FindOptionsRelations<Unit>,
  ) {
    return this.unitService.find(
      {
        schoolId: filter.schoolId,
        title: filter.title,
        courseId: filter.courseId,
        id: filter.id,
        ...(filter.trackId ? { course: { trackId: filter.trackId } } : {}),
      },
      relations,
    );
  }

  getLessons(
    filter: {
      unitId?: UUID;
      courseId?: UUID;
      schoolId?: UUID;
      title?: string;
      trackId?: UUID;
      status?: LessonStatusType;
    },
    relations?: FindOptionsRelations<Lesson>,
  ) {
    // lessons carry no courseId/trackId columns — both go through the unit
    const unitWhere = {
      ...(filter.courseId ? { courseId: filter.courseId } : {}),
      ...(filter.trackId ? { course: { trackId: filter.trackId } } : {}),
    };
    return this.lessonService.find(
      {
        unitId: filter.unitId,
        schoolId: filter.schoolId,
        title: filter.title,
        status: filter.status,
        ...(Object.keys(unitWhere).length ? { unit: unitWhere } : {}),
      },
      relations,
    );
  }

  // Single lesson by id, scoped by the caller (school/track/status). Returns
  // null when nothing matches the scope. `relations` lets the caller pull the
  // unit/course chain when it needs the lesson's place in the tree.
  async getLesson(
    filter: {
      id: UUID;
      schoolId?: UUID;
      trackId?: UUID;
      status?: LessonStatusType;
    },
    relations?: FindOptionsRelations<Lesson>,
    select?: FindOptionsSelect<Lesson>,
  ) {
    const lessons = await this.lessonService.find(
      {
        id: filter.id,
        schoolId: filter.schoolId,
        status: filter.status,
        ...(filter.trackId
          ? { unit: { course: { trackId: filter.trackId } } }
          : {}),
      },
      relations,
      select,
    );
    return lessons[0] ?? null;
  }

  // Seam for the student attempt flow: freezes a lesson's content once a
  // student has an attempt on it. Not reachable from the school facade.
  markLessonUsed(lessonId: UUID, em?: EntityManager) {
    return this.lessonService.markAsUsed(lessonId, em);
  }

  getQuestionsByCriteria(params: {
    params: QuestionGetDto | AdminQuestionGetDto;
    schoolId?: UUID;
    trackId?: UUID;
  }) {
    return this.questionService.getByCriteria(params);
  }

  getQuestion(filter: { id: UUID; schoolId?: UUID }) {
    return this.questionService.findOne({
      id: filter.id,
      ...(filter.schoolId ? { school: { id: filter.schoolId } } : {}),
    });
  }

  async checkQuestionAnswers(
    data: {
      id: UUID;
      answer: {
        choiceId?: UUID;
        boolAnswer?: boolean;
        matches?: { baseId: UUID; matchId: UUID }[];
      };
    }[],
    withCorrectAnswer?: boolean,
  ) {
    return await this.questionService.checkAnswers(data, withCorrectAnswer);
  }

  async findQuestions(
    params: FindOptionsWhere<Question>,
    select?: FindOptionsSelect<Question>,
  ) {
    return await this.questionService.find(params, select);
  }
}
