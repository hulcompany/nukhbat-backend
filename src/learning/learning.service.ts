import { Injectable } from '@nestjs/common';
import { SchoolAccessService } from '../school-access/school-access.service';
import { UUID } from 'crypto';

@Injectable()
export class LearningService {
  constructor(private readonly schoolAccess: SchoolAccessService) {}

  async getSchoolAccessableTracks(id: UUID) {
    return this.schoolAccess.getSchoolAccessableTracks(id);
  }

  async assertSchoolTrackAccess(id: UUID, trackId: UUID) {
    return this.schoolAccess.assertTrackAccess(id, trackId);
  }
}
