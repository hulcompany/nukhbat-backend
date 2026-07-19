import { Injectable, Scope } from '@nestjs/common';
import { UUID } from 'crypto';
import { Context } from '../context';
import { BookService } from './books/book.services';
import { CourseService } from './course/course.service';
import { QuestionService } from './questions/questions.service';
import { SavedQuestionService } from './saved-questions/saved-question.service';
import { Book } from './books/entity/book.entity';
import { Question } from './questions/entity/questions.entity';

// Student-facing sibling of LearningSchoolService. Request-scoped: it pins
// every read to the authenticated StudentProfile (school + track, set on the
// context by StudentGuard), so the only client input is a resource id and the
// school/track scope can never be overridden by the caller.
@Injectable({ scope: Scope.REQUEST })
export class LearningStudentService {
  constructor(
    private readonly bookService: BookService,
    private readonly courseService: CourseService,
    private readonly questionService: QuestionService,
    private readonly savedQuestions: SavedQuestionService,
    private readonly context: Context,
  ) {}

  private get student() {
    return this.context.student;
  }

  async getMyBooks() {
    return this.bookService.findBooks({
      school: { id: this.student.schoolId },
    } as any);
  }

  async getMyCourses() {
    return this.courseService.find({ trackId: this.student.trackId });
  }

  // Saved questions — bookmarks scoped to this student
  async saveQuestion(questionId: UUID) {
    // reject saving a question outside the student's school
    await this.questionService.findOne({
      id: questionId,
      school: { id: this.student.schoolId },
    } as any);
    return this.savedQuestions.save(this.student.id, questionId);
  }

  async getSavedQuestions() {
    return this.savedQuestions.findAll(this.student.id);
  }

  async getSavedQuestion(id: UUID) {
    return this.savedQuestions.findOneOrFail({
      id,
      studentProfileId: this.student.id,
    });
  }

  async removeSavedQuestion(id: UUID) {
    return this.savedQuestions.remove({
      id,
      studentProfileId: this.student.id,
    });
  }
}
