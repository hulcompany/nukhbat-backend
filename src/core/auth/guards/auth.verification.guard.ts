// import {
//   CanActivate,
//   ExecutionContext,
//   HttpStatus,
//   mixin,
//   Type,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { AppHttpError, ErrorCommonCodes } from 'core';

// export function AuthVerificationGuard(): Type<CanActivate> {
//   class EmailVerifiedGuardMixin implements CanActivate {
//     canActivate(context: ExecutionContext): boolean {
//       const request = context.switchToHttp().getRequest();
//       const user = request.user;
//       if (!user?.emailVerified) {
//         throw new AppHttpError({
//           code: ErrorCommonCodes.accountNotVerifiedYet,
//           statusCode: HttpStatus.FORBIDDEN,
//           message: 'Account not verified yet',
//         });
//       }
//       return true;
//     }
//   }

//   return mixin(EmailVerifiedGuardMixin);
// }
