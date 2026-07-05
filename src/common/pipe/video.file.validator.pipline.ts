import { FileValidationPipeline } from 'core';

export class VideoFileValidatorPipeline extends FileValidationPipeline {
  constructor(required?: boolean) {
    super({
      size: 80 * 1024 * 1024,
      required: required,
      types: [
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-msvideo',
        'video/mpeg',
        'video/ogg',
        'video/3gpp',
        'video/3gpp2',
        'video/x-matroska',
        'video/x-flv',
        'video/x-ms-wmv',
        'video/av1',
        'video/vp8',
        'video/vp9',
        'video/h264',
        'video/hevc',
      ],
    });
  }
}
