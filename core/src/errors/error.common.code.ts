import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

export enum ErrorCommonCodes {
  badInput = 'BAD_INPUT',
  notFound = 'NOT_FOUND',
  forbidden = 'FORBIDDEN',
  conflict = 'CONFLICT',
  internal = 'INTERNAL',
  unprocessableEntity = 'UNPROCESSABLE_ENTITY',
  unauthenticated = 'UNAUTHENTICATED',
  unauthorized = 'UNAUTHORIZED',
  invalidJwtToken = 'INVALID_JWT_TOKEN',
  jwtTokenExpired = 'JWT_TOKEN_EXPIRED',
  forbiddenQueryField = 'FORBIDDEN_QUERY_FIELD',
  forbiddenBodyField = 'FORBIDDEN_BODY_FIELD',
  wrongOtp = 'WRONG_OTP',
  wrongPassword = 'WRONG_PASSWORD',
  emailNotFound = 'EMAIL_NOT_FOUND',
  userNotFound = 'USER_NOT_FOUND',
  unknownError = 'UNKNOWN_ERROR',
  passwordMissmatched = 'PASSWORD_MISSMATCH',
  fileSizeNotAllowed = 'FILE_SIZE_NOT_ALLOWED',
  fileTypeNotAppowed = 'FILE_TYPE_NOT_ALLOWED',
  accountNotCompletedYet = 'ACCOUNT_NOT_COMPLETED_YET',
  accountNotVerifiedYet = 'ACCOUNT_NOT_VERIFIED_YET',
  invalidCredentials = 'INVALID_CREDENTIALS',
  userAlreadyExists = 'USER_ALREADY_EXISTS',
  versionNotSupported = 'VERSION_NOT_SUPPORTED',
}

export function mapExceptionToCommonCode(exception: unknown): ErrorCommonCodes {
  if (exception instanceof NotFoundException) {
    return ErrorCommonCodes.notFound;
  }

  if (exception instanceof ConflictException) {
    return ErrorCommonCodes.conflict;
  }

  if (exception instanceof BadRequestException) {
    return ErrorCommonCodes.badInput;
  }

  if (exception instanceof ForbiddenException) {
    return ErrorCommonCodes.forbidden;
  }

  if (exception instanceof UnauthorizedException) {
    return ErrorCommonCodes.unauthenticated;
  }

  if (exception instanceof UnprocessableEntityException) {
    return ErrorCommonCodes.unprocessableEntity;
  }

  if (exception instanceof InternalServerErrorException) {
    return ErrorCommonCodes.internal;
  }

  if (exception instanceof HttpException) {
    // Fallback based on status code
    switch (exception.getStatus()) {
      case 400:
        return ErrorCommonCodes.badInput;
      case 401:
        return ErrorCommonCodes.unauthenticated;
      case 403:
        return ErrorCommonCodes.forbidden;
      case 404:
        return ErrorCommonCodes.notFound;
      case 409:
        return ErrorCommonCodes.conflict;
      case 422:
        return ErrorCommonCodes.unprocessableEntity;
      case 500:
        return ErrorCommonCodes.internal;
      default:
        return ErrorCommonCodes.unknownError;
    }
  }

  return ErrorCommonCodes.unknownError;
}

export const ErrorCommonDescriptions: Record<ErrorCommonCodes, string> = {
  [ErrorCommonCodes.badInput]: 'The request contains invalid input.',
  [ErrorCommonCodes.notFound]: 'The requested resource was not found.',
  [ErrorCommonCodes.forbidden]: 'Access to this resource is forbidden.',
  [ErrorCommonCodes.conflict]: 'The resource already exists or conflicts.',
  [ErrorCommonCodes.internal]: 'An internal server error occurred.',
  [ErrorCommonCodes.unprocessableEntity]: 'The request could not be processed.',
  [ErrorCommonCodes.unauthenticated]: 'Authentication is required.',
  [ErrorCommonCodes.unauthorized]: 'You are not authorized.',
  [ErrorCommonCodes.invalidJwtToken]: 'The JWT token is invalid.',
  [ErrorCommonCodes.jwtTokenExpired]: 'The JWT token has expired.',
  [ErrorCommonCodes.forbiddenQueryField]: 'A query field is not allowed.',
  [ErrorCommonCodes.forbiddenBodyField]: 'A body field is not allowed.',
  [ErrorCommonCodes.wrongOtp]: 'The OTP is incorrect.',
  [ErrorCommonCodes.wrongPassword]: 'The password is incorrect.',
  [ErrorCommonCodes.emailNotFound]: 'Email address was not found.',
  [ErrorCommonCodes.userNotFound]: 'User was not found.',
  [ErrorCommonCodes.unknownError]: 'An unknown error occurred.',
  [ErrorCommonCodes.passwordMissmatched]: 'Passwords do not match.',
  [ErrorCommonCodes.fileSizeNotAllowed]: 'File size is not allowed.',
  [ErrorCommonCodes.fileTypeNotAppowed]: 'File type is not allowed.',
  [ErrorCommonCodes.accountNotCompletedYet]: 'Account setup is not complete.',
  [ErrorCommonCodes.invalidCredentials]: 'Invalid credentials.',
  [ErrorCommonCodes.userAlreadyExists]: 'User already exists.',
  [ErrorCommonCodes.versionNotSupported]: 'Version is not supported.',
  [ErrorCommonCodes.accountNotVerifiedYet]: 'Account Not Verified yet',
};
