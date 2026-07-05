import { DataSource, EntityManager } from 'typeorm';

export async function transaction(
  ds: DataSource,
  handler: (em: EntityManager) => Promise<any>,
  opts: { onError?: (e: any) => any; onDone?: () => any } = {},
) {
  let qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    let res = await handler(qr.manager);
    await qr.commitTransaction();
    if (opts.onDone) {
      opts.onDone();
    }
    return res;
  } catch (e) {
    await qr.rollbackTransaction();
    if (opts.onError) {
      opts.onError(e);
    }
    throw e;
  } finally {
    await qr.release();
  }
}
