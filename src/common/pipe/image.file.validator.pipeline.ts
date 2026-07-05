import { FileValidationPipeline } from 'core';

export class ImageFileValidatorPipeline extends FileValidationPipeline {
  constructor(required?: boolean) {
    super({
      size: 10 * 1024 * 1024,
      required: required,
      types: ['image/png', 'image/jpeg', 'image/jpg'],
    });
  }
}
