import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { runSeeders, SeederOptions } from 'typeorm-extension';
import { AppDataSource } from '../ds';
import { MainSeeder } from './main.seeder';
import { UserFactory } from '../factory/user.factory';
import { FaqFactory } from '../factory/faq.factory';
import { InfoFactory } from '../factory/info.factory';
import { DailyWisementFactory } from '../factory/daily-wisement.factory';
// import { UserFactory } from '../user.factory';

export const seederOptions: SeederOptions = {
  factories: [UserFactory, FaqFactory, InfoFactory, DailyWisementFactory],
  seeds: [MainSeeder],
};

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
  await runSeeders(AppDataSource, seederOptions);
  await ds.destroy();
  console.log('✅ Seed');
}
