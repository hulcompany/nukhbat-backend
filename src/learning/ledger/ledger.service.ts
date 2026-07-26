import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LedgerEntry } from './entity/ledger-entry.entity';
import {
  DataSource,
  EntityManager,
  FindOptionsRelations,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { UUID } from 'crypto';
import { StudentService } from '../../student/student.service';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly repo: Repository<LedgerEntry>,
    private readonly ds: DataSource,
    private readonly studentService: StudentService,
  ) {}

  async find(
    filters: FindOptionsWhere<LedgerEntry>,
    relations?: FindOptionsRelations<LedgerEntry>,
  ) {
    return this.repo.find({ where: filters, relations: relations });
  }

  async insertLedge(
    ids: {
      studentId: UUID;
      schoolId: UUID;
      trackId: UUID;
    },
    params: {
      xp?: number;
      gem?: number;
      sourceName: string;
    },
    em?: EntityManager,
  ) {
    let repo = em?.getRepository(LedgerEntry) || this.repo;
    if (!params.xp && !params.gem) {
      return { xp: 0, gems: 0 };
    } else {
      await repo.save({
        studentId: ids.studentId,
        schoolId: ids.schoolId,
        trackId: ids.trackId,
        xp: params.xp,
        gems: params.gem,
        sourceName: params.sourceName,
      });
      await this.studentService.ledgeBalance(ids.studentId, {
        em,
        xp: params.xp,
        gems: params.gem,
      });
    }
  }
}
