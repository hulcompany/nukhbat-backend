import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEntry } from './entity/ledger-entry.entity';
import { LedgerService } from './ledger.service';
import { StudentModule } from '../../student/student.module';

// Reward ledger — no controllers; it's an internal service the solving flow
// writes to and other modules read from.
@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntry]), StudentModule],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
