import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SchoolAccess } from './entity/school-access.entity';
import { SchoolAccessService } from './school-access.service';
import { SchoolAccessController } from './school-access.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SchoolAccess,
    ]),
  ],

  controllers: [
    SchoolAccessController,
  ],

  providers: [
    SchoolAccessService,
  ],

  exports: [
    SchoolAccessService,
  ],
})
export class SchoolAccessModule {}