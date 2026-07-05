import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCommonCodes } from 'core';

export class JwtGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (!user || err) {
      throw new UnauthorizedException({
        code: ErrorCommonCodes.unauthenticated,
        message: 'Unauthenticated',
      });
    }
    return user;
  }
}

export class JwtGuardStrict extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (!user || err) {
      throw new UnauthorizedException({
        code: ErrorCommonCodes.unauthenticated,
        message: 'Unauthenticated',
      });
    }
    if (!user?.emailVerfied) {
      throw new ForbiddenException({
        code: ErrorCommonCodes.accountNotVerifiedYet,
        message: 'Account not verified yet',
      });
    }
    if (!user?.isCompleted) {
      throw new ForbiddenException({
        code: ErrorCommonCodes.accountNotVerifiedYet,
        message: 'Account not completed yet',
      });
    }
    return user;
  }
}

export class JwtOptionalGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return user || null;
  }
}
