import { DataSource } from 'typeorm';
import { SubscriptionType } from '../../subscription/entity/subscription.entity';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

// Enrolls the seeded student on the default school's first track with a live
// free-trial subscription so the student guards let them through.
export async function seedStudents(ds: DataSource) {
  const userRepo = ds.getRepository('User');
  const schoolRepo = ds.getRepository('School');
  const trackRepo = ds.getRepository('Track');
  const profileRepo = ds.getRepository('StudentProfile');
  const subRepo = ds.getRepository('Subscription');

  const user = await userRepo.findOne({ where: { email: 'student@hul.com' } });
  const school = await schoolRepo.findOne({ where: { default: true } });
  const track = await trackRepo.find({ order: { createdAt: 'ASC' }, take: 1 });

  const profile = await profileRepo.save({
    userId: user!.id,
    schoolId: school!.id,
    trackId: track[0].id,
  });

  await subRepo.insert({
    type: SubscriptionType.freeTrial,
    expireDate: new Date(Date.now() + THIRTY_DAYS),
    studentProfileId: profile.id,
  });
}
