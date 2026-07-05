import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Res,
} from '@nestjs/common';
import { FileService } from './file.service';
import { UUID } from 'node:crypto';
import { Response, Request } from 'express';
import { ParseUUIDPipe } from '@nestjs/common';
import { FileProvider } from './provider/file.provider';
// import { SkipVersionCheck } from '../../../real_estate_api/src/common/guards/version.guard';
@Controller('files')
export class FileController {
  constructor(
    @Inject() private readonly service: FileService,
    private readonly provider: FileProvider,
  ) {}

  // @SkipVersionCheck()
  @Get('/:id')
  async getById(
    @Param('id', new ParseUUIDPipe()) id: UUID,
    @Res() res: Response,
  ) {
    let file = await this.service.getById(id);
    res.setHeader('Content-Type', file.type);
    return res.status(200).sendFile(await this.provider.buildLink(file.key));
  }
}
