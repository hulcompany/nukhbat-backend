import { HttpException, HttpStatus } from '@nestjs/common';

interface AppErrorOptions {
  code: string;
  message?: string;
  statusCode?: HttpStatus;
  args?: Record<string, any>;
}

export class AppHttpError extends HttpException {
  statusCode!: number;
  code: string;
  args?: any;
  constructor(opts: AppErrorOptions) {
    super(
      {
        message: opts.message,
        code: opts.code,
        args: opts.args,
      },
      opts.statusCode ?? 500,
    );
    this.statusCode = opts.statusCode ?? 500;
    this.code = opts.code;
    this.args = opts.args;
  }
}
