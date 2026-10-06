import { DataSource } from 'typeorm';

// Global content: tracks + their courses (not school-scoped).
export async function seedContent(ds: DataSource) {
  const { tracks } = learningFactory();

  await ds.transaction(async (manager) => {
    // Serialize this CLI seeder without changing the schema. Course has no
    // unique (trackId, title) constraint, so concurrent runs need a lock.
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'nukhba:curriculum-seed',
    ]);

    const trackRepo = manager.getRepository('Track');
    const courseRepo = manager.getRepository('Course');

    for (const track of tracks) {
      let savedTrack = await trackRepo.findOne({ where: { name: track.name } });
      if (!savedTrack) {
        savedTrack = await trackRepo.save({ name: track.name });
      }

      for (const course of track.courses) {
        const exists = await courseRepo.exists({
          where: { trackId: savedTrack.id, title: course.name },
        });
        if (!exists) {
          await courseRepo.insert({
            title: course.name,
            trackId: savedTrack.id,
          });
        }
      }
    }
  });
}

const courses = (...names: string[]) => names.map((name) => ({ name }));

// The general and ninth religious track lists were supplied by the project
// owner. The upper-secondary religious tracks remain provisional subsets.

// 2026–2027 uses the 2025–2026 Damascus curriculum. Current subject lists:
// https://sana.sy/education/2555148/
// https://nccd.gov.sy/book?i=12 (grade 9 textbook titles)
// https://nccd.gov.sy/book?i=15 (secondary textbook titles)
// The older NCCD catalogue still displays الوطنية; it was cancelled in 2025:
// https://sana.sy/education/2180107/
// Kurdish is offered regionally as a subject in all grades in 2026–2027:
// https://sana.sy/education/2564638/
// Religious-school timetables must be checked against the Ministry of Awqaf's
// published plan before adding any unverified subjects:
// https://telegram.me/s/ta3leem_2025/1412
export const learningFactory = () => {
  return {
    tracks: [
      {
        name: 'تاسع',
        courses: courses(
          'اللغة العربية',
          'الجبر',
          'الهندسة',
          'الفيزياء والكيمياء',
          'علم الأحياء والأرض',
          'التاريخ',
          'الجغرافية',
          'اللغة الإنكليزية',
          'اللغة الفرنسية',
          'اللغة الروسية',
          'التربية الدينية الإسلامية',
          'الديانة المسيحية',
          'تكنولوجيا المعلومات',
          'التربية الفنية',
          'التربية الموسيقية',
        ),
      },
      {
        name: 'تاسع شرعي',
        courses: courses(
          'اللغة العربية',
          'الجبر',
          'الهندسة',
          'الفيزياء والكيمياء',
          'علم الأحياء والأرض',
          'التاريخ',
          'الجغرافية',
          'اللغة الإنكليزية',
          'اللغة الفرنسية',
          'اللغة الروسية',
          'التفسير',
          'الفقه الإسلامي',
          'الحديث النبوي',
          'العقيدة الإسلامية',
          'التلاوة والاستحفاظ',
          'الخطابة والدعوة',
        ),
      },
      {
        name: 'بكالوريا علمي',
        courses: courses(
          'اللغة العربية',
          'الرياضيات',
          'الفيزياء',
          'الكيمياء',
          'علم الأحياء',
          'اللغة الإنكليزية',
          'اللغة الفرنسية',
          'اللغة الروسية',
          'التربية الدينية الإسلامية',
          'التربية المسيحية',
        ),
      },
      {
        name: 'بكالوريا أدبي',
        courses: courses(
          'اللغة العربية',
          'الفلسفة',
          'التاريخ',
          'الجغرافية',
          'اللغة الإنكليزية',
          'اللغة الفرنسية',
          'اللغة الروسية',
          'التربية الإسلامية',
          'التربية المسيحية',
        ),
      },
      {
        name: 'بكالوريا شرعي علمي',
        // Only courses explicitly corroborated for religious secondary
        // schools are listed until the official timetable PDF can be read.
        // https://sana.sy/education/2482891/
        // https://sana.sy/governorates/aleppo/2484124/
        courses: courses(
          'اللغة العربية',
          'التلاوة والاستحفاظ',
          'الخطابة والدعوة',
        ),
      },
      {
        name: 'بكالوريا شرعي أدبي',
        courses: courses(
          'اللغة العربية',
          'التلاوة والاستحفاظ',
          'الخطابة والدعوة',
        ),
      },
    ],
  };
};
