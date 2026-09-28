import 'reflect-metadata';
import { AppDataSource } from './ds';
import { seedCurriculum } from './seeders/curriculum-seed';

// This seed command is intentionally non-destructive. It only adds missing
// tracks and courses and never deletes existing database records.
export async function seed() {
  await AppDataSource.initialize();
  await AppDataSource.runMigrations();
  await seedCurriculum(AppDataSource);
  await AppDataSource.destroy();
  console.log('✅ Curriculum seed completed');
}
