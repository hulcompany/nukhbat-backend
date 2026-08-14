import { BadRequestException } from '@nestjs/common';
import { SolvingLessonsService } from './solving-lessons.service';

describe('SolvingLessonsService snapshot locking', () => {
  it('unlocks the snapshot when solving fails after lock acquisition', async () => {
    const snapshot = {
      id: '00000000-0000-4000-8000-000000000001',
      studentId: '00000000-0000-4000-8000-000000000002',
      dailyChallengeId: '00000000-0000-4000-8000-000000000003',
      lessonId: null,
      unitId: null,
      courseId: null,
      questions: [],
      createdAt: new Date().toISOString(),
    };
    const snapshots = {
      getQuestionSnapshot: jest.fn().mockResolvedValue(snapshot),
      lockQuestionSnapshot: jest.fn().mockResolvedValue('lock-token'),
      unlockQuestionSnapshot: jest.fn().mockResolvedValue(true),
    };
    const service = new SolvingLessonsService(
      {} as any,
      snapshots as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.solve(
        { id: snapshot.studentId } as any,
        { snapshotId: snapshot.id, answers: [] } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(snapshots.getQuestionSnapshot).toHaveBeenCalledTimes(2);
    expect(snapshots.unlockQuestionSnapshot).toHaveBeenCalledWith(
      snapshot.id,
      'lock-token',
    );
  });
});
