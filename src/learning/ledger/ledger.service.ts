import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LedgerEntry } from './entity/ledger-entry.entity';
import {
  EntityManager,
  FindOptionsRelations,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { UUID } from 'crypto';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly repo: Repository<LedgerEntry>,
  ) {}

  async find(
    filters: FindOptionsWhere<LedgerEntry>,
    relations?: FindOptionsRelations<LedgerEntry>,
  ) {
    return this.repo.find({ where: filters, relations: relations });
  }

  async insertLedge(
    studentId: UUID,
    params: {
      xp?: number;
      gem?: number;
      schoolId: UUID;
      trackId: UUID;
      em?: EntityManager;
    },
  ) {
    if (!params.xp && !params.gem) {
      return null;
    }
    return await (params.em?.getRepository(LedgerEntry) || this.repo).save(
      this.repo.create({ studentId, ...params }),
    );
  }
}
