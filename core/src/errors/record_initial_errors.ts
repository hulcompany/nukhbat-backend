import { ErrorsRecord } from './exceptions';
import { ErrorCommonDescriptions } from './error.common.code';

export const RecordInitialErrors = () => {
  ErrorsRecord.addErrors(
    'MainErrors',
    Object.entries(ErrorCommonDescriptions).map(([code, description]) => ({
      code,
      description,
    })),
  );
};

/*
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  NotAcceptableException,
  RequestTimeoutException,
  ConflictException,
  GoneException,
  HttpVersionNotSupportedException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
  InternalServerErrorException,
  NotImplementedException,
  ImATeapotException,
  MethodNotAllowedException,
  BadGatewayException,
  ServiceUnavailableException,
  GatewayTimeoutException,
  PreconditionFailedException,
} from '@nestjs/common';
import { ErrorsRecord } from './exceptions';
import { PasswordMissmatchException } from '../dto';
import { FileSizeNotAllowed, FileTypeNotAllowed } from '../nestjs';

export const RecordInitialErrors = () => {
  ErrorsRecord.addErrors('MainErrors', [
    new BadRequestException(),
    new UnauthorizedException(),
    new NotFoundException(),
    new ForbiddenException(),
    new NotAcceptableException(),
    new RequestTimeoutException(),
    new ConflictException(),
    new GoneException(),
    new HttpVersionNotSupportedException(),
    new PayloadTooLargeException(),
    new UnsupportedMediaTypeException(),
    new UnprocessableEntityException(),
    new InternalServerErrorException(),
    new NotImplementedException(),
    new ImATeapotException(),
    new MethodNotAllowedException(),
    new BadGatewayException(),
    new ServiceUnavailableException(),
    new GatewayTimeoutException(),
    new PreconditionFailedException(),
  ]);
  ErrorsRecord.addErrors('validator', [new PasswordMissmatchException()]);
  ErrorsRecord.addErrors('casl', [new ForbiddenException()]);
  ErrorsRecord.addErrors('nestJS', [
    new FileSizeNotAllowed(),
    new FileTypeNotAllowed(),
  ]);
};
*/
