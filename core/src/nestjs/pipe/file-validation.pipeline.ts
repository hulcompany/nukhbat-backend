import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { FileSizeNotAllowed, FileTypeNotAllowed } from '../errors';

@Injectable()
export class FileValidationPipeline implements PipeTransform {
  constructor(
    readonly opts?: {
      size?: number,
      types?: string[],
      required?: boolean,
    },
  ) {
  }

  transform(value: any, metadata: ArgumentMetadata) {    
    if (!value && this.opts?.required) {
      throw new BadRequestException('File is required to complete the request');
    }
    if(!value){
      return ;
    }
    if (this.opts?.size && value.size > this.opts?.size) {
      throw new FileSizeNotAllowed(value.size, this.opts.size);
    }

    if (this.opts?.types && !this.opts.types.includes(value.mimetype)) {
      throw new FileTypeNotAllowed(value.mimetype, this.opts.types);
    }
    return value;
  }
}