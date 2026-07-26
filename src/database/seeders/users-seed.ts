import { DataSource } from 'typeorm';
import { hashPassword } from 'core';

export async function seedUsers(ds: DataSource) {
  let repo = ds.getRepository('User');
  // insert() bypasses UserService's hashing, so hash here (salt 10, same as
  // the service) — otherwise the stored value is plaintext and login fails
  const password = await hashPassword('12345678', 10);
  await repo.insert([
    {
      name: 'admin',
      email: 'admin@hul.com',
      password,
      role: 'admin',
      emailVerified: true,
    },
    {
      name: 'default school',
      email: 'content@hul.com',
      password,
      role: 'contentWriter',
      emailVerified: true,
    },
    {
      name: 'student',
      email: 'student@hul.com',
      password,
      role: 'student',
      emailVerified: true,
    },
  ]);
}
