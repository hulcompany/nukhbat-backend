import { Request, RequestHandler, Response } from 'express';
import { ErrorCommonCodes } from './error.common.code';

interface ErrorInfo {
  code: string;
  description: string;
}

class ErrorRecord {
  private table: Map<string, ErrorInfo[]>;

  constructor() {
    this.table = new Map<string, ErrorInfo[]>();
  }

  getErrorsMap(): Map<string, ErrorInfo[]> {
    return this.table;
  }

  addErrors(feature: string, errors: ErrorInfo[]): void {
    this.table.set(feature, errors);
  }

  getErrorsAsList(): ErrorInfo[] {
    return Array.from(this.table.values()).flat();
  }

  getError(code: string): { message: string; code: string } {
    for (const errors of this.table.values()) {
      const error = errors.find((e) => e.code === code);

      if (error) {
        return {
          message: error.description,
          code: error.code,
        };
      }
    }

    return {
      message: 'An unknown error occurred.',
      code: ErrorCommonCodes.unknownError,
    };
  }
}

const errorRecord = new ErrorRecord();

export function createErrorRequestHandler(): RequestHandler {
  return (_req: Request, res: Response) => {
    res.json(Object.fromEntries(errorRecord.getErrorsMap()));
  };
}

export { errorRecord as ErrorsRecord };
export type { ErrorInfo };
