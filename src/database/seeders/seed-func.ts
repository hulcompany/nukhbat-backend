import 'reflect-metadata';
import { runSeeders, SeederOptions } from 'typeorm-extension';
import { AppDataSource } from '../ds';
import { MainSeeder } from './main.seeder';
import { UserFactory } from '../factory/user.factory';
import { FaqFactory } from '../factory/faq.factory';
import { InfoFactory } from '../factory/info.factory';
// import { UserFactory } from '../user.factory';

export const seederOptions: SeederOptions = {
  factories: [UserFactory, FaqFactory, InfoFactory],
  seeds: [MainSeeder],
};

export async function seed() {
  let ds = AppDataSource;
  await ds.initialize();
  await runSeeders(AppDataSource, seederOptions);
  await ds.destroy();
  console.log('✅ Seed');
}
