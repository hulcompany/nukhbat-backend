import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AppHttpError, ErrorCommonCodes, mapExceptionToCommonCode } from 'core';
import { Response } from 'express';
import { TypeORMError } from 'typeorm';
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppHttpError) {
      return response.status(exception.statusCode).json({
        message: exception.message,
        code: exception.code,
        args: exception.args,
      });
    }
    if (exception instanceof HttpException) {
      let error = exception.getResponse();
      return response.status(exception.getStatus()).json({
        message: error['message']?.toString() || exception.message,
        code: error['code'] ?? mapExceptionToCommonCode(exception),
      });
    }

    if (exception instanceof TypeORMError) {
      if (exception.name == 'UpdateValuesMissingError') {
        throw new BadRequestException('At least one Field is Required');
      }
      if ((exception as any).code == 23503) {
        throw new NotFoundException('Some Resources are not found');
      }
    }
    console.log(exception);

    response.status(500).json({
      message: 'Internal Server Error',
      code: ErrorCommonCodes.internal,
    });
  }
}
