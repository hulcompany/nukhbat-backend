import { DataSource } from 'typeorm';

type SeedCourse = {
  name: string;
};

type SeedTrack = {
  name: string;
  courses: SeedCourse[];
};

export const CURRICULUM: SeedTrack[] = [
  {
    name: 'الصف التاسع',
    courses: [
      { name: 'الرياضيات' },
      { name: 'اللغة العربية' },
      { name: 'اللغة الإنكليزية' },
      { name: 'العلوم العامة' },
      { name: 'الاجتماعيات' },
    ],
  },
  {
    name: 'البكالوريا العلمي',
    courses: [
      { name: 'الرياضيات' },
      { name: 'الفيزياء' },
      { name: 'الكيمياء' },
      { name: 'اللغة العربية' },
      { name: 'اللغة الإنكليزية' },
    ],
  },
  {
    name: 'البكالوريا الأدبي',
    courses: [
      { name: 'اللغة العربية' },
      { name: 'التاريخ' },
      { name: 'الجغرافيا' },
      { name: 'الفلسفة' },
      { name: 'اللغة الإنكليزية' },
    ],
  },
];

export async function seedCurriculum(ds: DataSource) {
  const trackRepo = ds.getRepository('Track');
  const courseRepo = ds.getRepository('Course');

  for (const track of CURRICULUM) {
    const savedTrack =
      (await trackRepo.findOne({ where: { name: track.name } })) ??
      (await trackRepo.save({ name: track.name }));

    for (const course of track.courses) {
      const existingCourse = await courseRepo.findOne({
        where: {
          title: course.name,
          trackId: savedTrack.id,
        },
      });

      if (!existingCourse) {
        await courseRepo.insert({
          title: course.name,
          trackId: savedTrack.id,
        });
      }
    }
  }
}
