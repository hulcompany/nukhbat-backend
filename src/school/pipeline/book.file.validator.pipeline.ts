import { FileValidationPipeline } from 'core';

export class BookFileValidatorPipeline extends FileValidationPipeline {
  constructor(required?: boolean) {
    super({
      size: 100 * 1024 * 1024,
      required: required,
      types: ['application/pdf', 'application/x-pdf'],
    });
  }
}
