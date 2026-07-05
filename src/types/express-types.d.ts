import { CASLPermission } from 'core';
import { User } from '../core/user/entity/user.entity';
import { School } from '../school/entity/school.entity';

declare global {
  namespace Express {
    interface Request {
      context: {
        user?: User;
        school?: School;
      };
      // userContext: {
      //   casl?: CASLPermission;
      //   user?: User;
      // };
      // school: School;
    }
  }
}

export {};
