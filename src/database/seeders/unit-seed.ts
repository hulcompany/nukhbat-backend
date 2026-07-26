import { DataSource } from 'typeorm';

// Units are school-scoped: each school builds its own units under the global
// courses. Here the default school gets 2 units per course.
export async function seedUnits(ds: DataSource) {
  const unitRepo = ds.getRepository('Unit');
  const courseRepo = ds.getRepository('Course');
  const schoolRepo = ds.getRepository('School');

  const school = await schoolRepo.findOne({ where: { default: true } });
  const courses = await courseRepo.find();

  for (const course of courses) {
    await unitRepo.insert([
      {
        title: `الوحدة 1 - ${course.title}`,
        courseId: course.id,
        schoolId: school!.id,
        index: 1,
      },
      {
        title: `الوحدة 2 - ${course.title}`,
        courseId: course.id,
        schoolId: school!.id,
        index: 2,
      },
    ]);
  }
}
