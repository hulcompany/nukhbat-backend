import { CASLPermission } from '../casl';

declare global {
  namespace Express {
    interface Request {
      permissions: CASLPermission;
    }
  }
}

export {};
