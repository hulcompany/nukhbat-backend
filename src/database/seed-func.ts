import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';
import { AppDataSource } from './ds';
import { seedUsers } from './seeders/users-seed';
import { seedSchool } from './seeders/school-seed';
import { seedContent } from './seeders/content-seed';
import { seedSchoolAccess } from './seeders/school-access-seed';
import { seedUnits } from './seeders/unit-seed';
import { seedLessons } from './seeders/lesson-seed';
import { seedQuestions } from './seeders/question-seed';
import { seedFaqs } from './seeders/faq-seed';
import { seedInfo } from './seeders/info-seed';
import { seedDailyWisements } from './seeders/daily-wisement-seed';
import { seedStudents } from './seeders/student-seed';
import { seedAttempts } from './seeders/attempt-seed';
// import { UserFactory } from '../user.factory';


// AppDataSource has synchronize: true, so initialize() syncs the schema
// BEFORE the seeder's dropDatabase can run — an incompatible entity change
// (new unique index over existing duplicate rows, new non-null column, ...)
// then fails against the old data. Drop the whole schema over a bare
// connection first so initialize() always starts from empty.
async function resetDb() {
  const raw = new DataSource({
    type: 'postgres',
    url: process.env.DBLINK,
  });
  await raw.initialize();
  await raw.query('DROP SCHEMA public CASCADE');
  await raw.query('CREATE SCHEMA public');
  await raw.destroy();
}

export async function seed() {
  await resetDb();
  let ds = AppDataSource;
  // initialize() synchronizes the entities (synchronize: true); migrations
  // (the file soft-delete trigger) must run explicitly — the bare resetDb
  // connection has no migrations configured, so they'd be silently skipped
  await ds.initialize();
  await ds.runMigrations();

  // ordered by dependency: identities → school → global content →
  // school access → school-scoped tree → public content → student →
  // that student's solving history (attempts + ledger)
  await seedUsers(ds);
  await seedSchool(ds);
  await seedContent(ds);
  await seedSchoolAccess(ds);
  await seedUnits(ds);
  await seedLessons(ds);
  await seedQuestions(ds);
  await seedFaqs(ds);
  await seedInfo(ds);
  await seedDailyWisements(ds);
  await seedStudents(ds);
  await seedAttempts(ds);

  await ds.destroy();
  console.log('✅ Seed');
}
