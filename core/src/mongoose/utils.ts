import mongoose, { ClientSession } from 'mongoose';

export async function executeWithTransaction(
  fn: (session: ClientSession) => Promise<any>,
): Promise<any> {
  let session = await mongoose.startSession();
  session.startTransaction();
  try {
    let res = await fn(session);
    await session.commitTransaction();
    await session.endSession();
    return res;
  } catch (e) {
    await session.abortTransaction();
    await session.endSession();
    throw e;
  }
}
export type MongoId = mongoose.ObjectId | string;
