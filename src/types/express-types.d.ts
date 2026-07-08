import { CASLPermission } from 'core';
import { User } from '../core/user/entity/user.entity';
import { School } from '../school/entity/school.entity';
import { StudentProfile } from '../student/entity/student-profile.entity';
import { Subscription } from '../subscription/entity/subscription.entity';

declare global {
  namespace Express {
    interface Request {
      context: {
        user?: User;
        school?: School;
        student?: StudentProfile,
        subscription?: Subscription,
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
