import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppFileSoftRemoveTrigger1782127318747
  implements MigrationInterface
{
  name = 'AppFileSoftRemoveTrigger1782127318747';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app_file_soft_delete_notify()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD."deletedAt" IS NULL
           AND NEW."deletedAt" IS NOT NULL THEN
          PERFORM pg_notify(
            'app_file_soft_delete',
            json_build_object(
              'id', NEW.id,
              'key', NEW.key,
              'type', NEW.type,
              'deletedAt', NEW."deletedAt"
            )::text
          );
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER app_file_soft_delete_trigger
      AFTER UPDATE OF "deletedAt" ON app_file
      FOR EACH ROW
      EXECUTE FUNCTION app_file_soft_delete_notify();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS app_file_soft_delete_trigger ON app_file;
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS app_file_soft_delete_notify;
    `);
  }
}