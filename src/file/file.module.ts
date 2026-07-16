import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppFile } from './entity/app-file.entity';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { FileDiskProvider } from './provider/file.disk.provider';
import { FileProvider } from './provider/file.provider';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AppFile])],
  providers: [
    FileService,
    {
      provide: FileProvider,
      useClass: FileDiskProvider,
    },
  ],
  controllers: [FileController],
  exports: [FileService],
})
export class FileModule {}
