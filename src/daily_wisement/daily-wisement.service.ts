import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { UUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import {
  applyPsqlFilter,
  BasePaginationModel,
  SortType,
  transaction,
} from 'core';
import { DailyWisement } from './entity/daily-wisement.entity';
import {
  DailyWisementCreateDto,
  DailyWisementEditDto,
  DailyWisementGetDto,
} from './dto/daily-wisement.dto';

@Injectable()
export class DailyWisementService {
  constructor(
    @InjectRepository(DailyWisement)
    private readonly repo: Repository<DailyWisement>,
    private readonly ds: DataSource,
  ) {}

  async create(dto: DailyWisementCreateDto) {
    return await this.repo.save(this.repo.create(dto));
  }

  // repo.save on an array runs in a single transaction — all-or-nothing
  async createMany(dtos: DailyWisementCreateDto[]) {
    return await this.repo.save(dtos.map((dto) => this.repo.create(dto)));
  }

  async getByCriteria(params: DailyWisementGetDto) {
    const qb = this.repo.createQueryBuilder('dw');
    applyPsqlFilter({
      queryBuilder: qb,
      query: params,
      options: {
        text: {
          regExp: { regexp: 'contains' },
        },
      },
    });
    qb.orderBy('dw.createdAt', params.sort || SortType.Desc);
    const [data, count] = await qb.getManyAndCount();
    return new BasePaginationModel({
      list: data,
      totalRecords: count,
      skip: params.skip,
      limit: params.limit,
    });
  }

  async getOneOrFail(id: UUID) {
    const wisement = await this.repo.findOne({ where: { id } });
    if (!wisement) {
      throw new NotFoundException('Daily wisement not found');
    }
    return wisement;
  }

  // today's wisement; when nothing is selected yet (fresh table or the
  // cron hasn't run) pick one on the spot
  async getToday() {
    const selected = await this.repo.findOne({ where: { selected: true } });
    if (selected) return selected;
    return await this.selectNext();
  }

  async update(id: UUID, dto: DailyWisementEditDto) {
    const wisement = await this.getOneOrFail(id);
    if (wisement.selected) {
      throw new BadRequestException('Cannot edit the selected daily wisement');
    }
    Object.assign(wisement, dto);
    return await this.repo.save(wisement);
  }

  async delete(id: UUID) {
    const wisement = await this.getOneOrFail(id);
    if (wisement.selected) {
      throw new BadRequestException(
        'Cannot delete the selected daily wisement',
      );
    }
    await this.repo.delete({ id });
  }

  // all-or-nothing: every id must exist and none may be the selected one
  async deleteMany(ids: UUID[]) {
    ids = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(ids) } });
    const found = new Set(rows.map((r) => r.id));
    for (const id of ids) {
      if (!found.has(id)) {
        throw new NotFoundException('Daily wisement not found ' + id);
      }
    }
    if (rows.some((r) => r.selected)) {
      throw new BadRequestException(
        'Cannot delete the selected daily wisement',
      );
    }
    await this.repo.delete({ id: In(ids) });
  }

  // rotation: a random unused row becomes selected + usedPreviously, the
  // previous selected is unselected. The selected row always carries
  // usedPreviously=true, so it never re-enters the candidate pool while
  // active. When the pool is exhausted, reset everyone except the current
  // selected and restart the loop (no immediate repeat).
  async selectNext() {
    return await transaction(this.ds, async (em) => {
      const repo = em.getRepository(DailyWisement);
      const current = await repo.findOne({ where: { selected: true } });

      let candidates = await repo.find({
        where: { usedPreviously: false },
        select: { id: true },
      });
      if (!candidates.length) {
        await repo.update(
          { usedPreviously: true, selected: false },
          { usedPreviously: false },
        );
        candidates = await repo.find({
          where: { usedPreviously: false },
          select: { id: true },
        });
      }
      // table is empty, or the selected row is the only one — keep it
      if (!candidates.length) return current;

      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (current) {
        await repo.update({ id: current.id }, { selected: false });
      }
      await repo.update(
        { id: pick.id },
        { selected: true, usedPreviously: true },
      );
      return await repo.findOne({ where: { id: pick.id } });
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async rotateDaily() {
    try {
      await this.selectNext();
    } catch (e) {
      console.log('Daily wisement rotation failed');
      console.log(e);
    }
  }
}
