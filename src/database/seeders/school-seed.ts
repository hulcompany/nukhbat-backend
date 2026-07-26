import { DataSource } from 'typeorm';

export async function seedSchool(ds: DataSource) {
  let repo = ds.getRepository('School');
  let userRepo = ds.getRepository('User');
  let user = await userRepo.findOne({ where: { email: 'content@hul.com' } });
  await repo.insert([
    {
      name: 'default school',
      default: true,
      owner: { id: user!.id },
    },
  ]);
}
