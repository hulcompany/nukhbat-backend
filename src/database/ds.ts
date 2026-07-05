import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: '.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  entities: [join(__dirname, '../', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
  migrationsRun: false,
  synchronize: true,
  url: process.env.DBLINK,
});
