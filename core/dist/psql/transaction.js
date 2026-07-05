"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transaction = transaction;
async function transaction(ds, handler, opts = {}) {
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
    }
    catch (e) {
        await qr.rollbackTransaction();
        if (opts.onError) {
            opts.onError(e);
        }
        throw e;
    }
    finally {
        await qr.release();
    }
}
//# sourceMappingURL=transaction.js.map