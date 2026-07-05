import { HttpException } from '@nestjs/common';
import { ErrorCommonCodes } from '../errors';

export class FileSizeNotAllowed extends HttpException {
  constructor(size?: number, foundedSize?: number) {
    super(
      {
        message:
          size && foundedSize
            ? `File Size Too Big ${size} must be less than or equal ${foundedSize}`
            : 'File Size Too Big',
        code: ErrorCommonCodes.fileSizeNotAllowed,
      },
      400,
    );
  }
}

export class FileTypeNotAllowed extends HttpException {
  constructor(type?: string, types?: string[]) {
    super(
      {
        message: types
          ? `File Not Allowed ${type} must be one of ${types}`
          : 'File Not Allowed',
        code: ErrorCommonCodes.fileTypeNotAppowed,
      },
      400,
    );
  }
}
