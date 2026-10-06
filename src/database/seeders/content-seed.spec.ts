import { DataSource } from 'typeorm';
import { learningFactory, seedContent } from './content-seed';

describe('Syrian curriculum seed', () => {
  it('contains six Arabic tracks with no duplicate subjects', () => {
    const { tracks } = learningFactory();
    const suppliedSubjects: Record<string, string[]> = {
      تاسع: [
        'اللغة العربية', 'الجبر', 'الهندسة', 'الفيزياء والكيمياء',
        'علم الأحياء والأرض', 'التاريخ', 'الجغرافية', 'اللغة الإنكليزية',
        'اللغة الفرنسية', 'اللغة الروسية', 'التربية الدينية الإسلامية',
        'الديانة المسيحية', 'تكنولوجيا المعلومات', 'التربية الفنية',
        'التربية الموسيقية',
      ],
      'تاسع شرعي': [
        'اللغة العربية', 'الجبر', 'الهندسة', 'الفيزياء والكيمياء',
        'علم الأحياء والأرض', 'التاريخ', 'الجغرافية', 'اللغة الإنكليزية',
        'اللغة الفرنسية', 'اللغة الروسية', 'التفسير', 'الفقه الإسلامي',
        'الحديث النبوي', 'العقيدة الإسلامية', 'التلاوة والاستحفاظ',
        'الخطابة والدعوة',
      ],
      'بكالوريا علمي': [
        'اللغة العربية', 'الرياضيات', 'الفيزياء', 'الكيمياء', 'علم الأحياء',
        'اللغة الإنكليزية', 'اللغة الفرنسية', 'اللغة الروسية',
        'التربية الدينية الإسلامية', 'التربية المسيحية',
      ],
      'بكالوريا أدبي': [
        'اللغة العربية', 'الفلسفة', 'التاريخ', 'الجغرافية',
        'اللغة الإنكليزية', 'اللغة الفرنسية', 'اللغة الروسية',
        'التربية الإسلامية', 'التربية المسيحية',
      ],
    };

    expect(tracks.map((track) => track.name)).toEqual([
      'تاسع',
      'تاسع شرعي',
      'بكالوريا علمي',
      'بكالوريا أدبي',
      'بكالوريا شرعي علمي',
      'بكالوريا شرعي أدبي',
    ]);

    for (const track of tracks) {
      const names = track.courses.map((course) => course.name);
      expect(names.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
      expect(names).not.toContain('التربية الوطنية');
      if (suppliedSubjects[track.name]) {
        expect(names).toEqual(suppliedSubjects[track.name]);
      }
    }
  });

  it('adds only missing records and leaves previous rows unchanged on rerun', async () => {
    const tracks = new Map<string, { id: string; name: string }>([
      ['الصف التاسع', { id: 'legacy-id', name: 'الصف التاسع' }],
      ['تاسع', { id: 'existing-id', name: 'تاسع' }],
    ]);
    const courses = new Set(['existing-id:اللغة العربية']);
    let nextId = 0;

    const trackRepo = {
      findOne: jest.fn(async ({ where }: { where: { name: string } }) =>
        tracks.get(where.name) ?? null,
      ),
      save: jest.fn(async ({ name }: { name: string }) => {
        const row = { id: `new-${++nextId}`, name };
        tracks.set(name, row);
        return row;
      }),
    };
    const courseRepo = {
      exists: jest.fn(
        async ({ where }: { where: { trackId: string; title: string } }) =>
          courses.has(`${where.trackId}:${where.title}`),
      ),
      insert: jest.fn(
        async ({ trackId, title }: { trackId: string; title: string }) => {
          courses.add(`${trackId}:${title}`);
        },
      ),
    };
    const manager = {
      query: jest.fn(async () => []),
      getRepository: jest.fn((entity: string) =>
        entity === 'Track' ? trackRepo : courseRepo,
      ),
    };
    const ds = {
      transaction: jest.fn(
        async (action: (entityManager: typeof manager) => Promise<void>) =>
          action(manager),
      ),
    } as unknown as DataSource;

    await seedContent(ds);
    const firstCourseCount = courses.size;
    await seedContent(ds);

    expect(tracks.get('الصف التاسع')).toEqual({
      id: 'legacy-id',
      name: 'الصف التاسع',
    });
    expect(tracks.get('تاسع')?.id).toBe('existing-id');
    expect(tracks.size).toBe(7);
    expect(courses.size).toBe(firstCourseCount);
    expect(trackRepo.save).toHaveBeenCalledTimes(5);
    expect(courseRepo.insert).toHaveBeenCalledTimes(firstCourseCount - 1);
    expect(manager.query).toHaveBeenCalledTimes(2);
  });
});
