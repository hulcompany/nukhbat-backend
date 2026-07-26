import { DataSource } from 'typeorm';
import { LessonStatusType } from '../../curriculum/lessons/entity/lesson.status.type';

// Lessons are school-scoped and hang off the school's units. 2 lessons per
// unit, published so seeded students can solve them.
export async function seedLessons(ds: DataSource) {
  const lessonRepo = ds.getRepository('Lesson');
  const unitRepo = ds.getRepository('Unit');

  const units = await unitRepo.find();

  for (const unit of units) {
    await lessonRepo.insert([
      {
        title: `الدرس 1 - ${unit.title}`,
        description: `شرح ${unit.title}`,
        unitId: unit.id,
        schoolId: unit.schoolId,
        index: 1,
        status: LessonStatusType.published,
      },
      {
        title: `الدرس 2 - ${unit.title}`,
        description: `شرح ${unit.title}`,
        unitId: unit.id,
        schoolId: unit.schoolId,
        index: 2,
        status: LessonStatusType.published,
      },
    ]);
  }
}
