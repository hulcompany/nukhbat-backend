import { DataSource } from 'typeorm';

// Global content: tracks + their courses (not school-scoped). A school gets
// wired to a track later through SchoolAccess (see school-access-seed).
export async function seedContent(ds: DataSource) {
  const trackRepo = ds.getRepository('Track');
  const courseRepo = ds.getRepository('Course');
  const { tracks } = learningFactory();

  for (const track of tracks) {
    const savedTrack = await trackRepo.save({ name: track.name });
    await courseRepo.insert(
      track.courses.map((c) => ({
        title: c.name,
        trackId: savedTrack.id,
      })),
    );
  }
}

export const learningFactory = () => {
  return {
    tracks: [
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
    ],
  };
};
