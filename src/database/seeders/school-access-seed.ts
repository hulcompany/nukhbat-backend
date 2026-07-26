import { DataSource } from 'typeorm';

// Grants the default school access to every track (which tracks a school may
// use). Units/lessons/questions below are then seeded for that school.
export async function seedSchoolAccess(ds: DataSource) {
  const accessRepo = ds.getRepository('SchoolAccess');
  const schoolRepo = ds.getRepository('School');
  const trackRepo = ds.getRepository('Track');

  const school = await schoolRepo.findOne({ where: { default: true } });
  const tracks = await trackRepo.find();

  await accessRepo.insert(
    tracks.map((t: any) => ({ schoolId: school!.id, trackId: t.id })),
  );
}
