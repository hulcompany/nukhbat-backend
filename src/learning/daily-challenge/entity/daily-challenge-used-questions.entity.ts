import { UUID } from 'crypto';
import { Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Question } from '../../questions/entity/questions.entity';
import { DailyChallenge } from './daily-challenge.entity';

// doubles as the per-challenge content AND, across all challenges of a
// school, the "already used" history that selection excludes from
@Entity()
@Index(['challenge.id', 'question.id'], { unique: true })
export class DailyChallengeUsedQuestions {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @ManyToOne(() => DailyChallenge, (v) => v.usedQuestions, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  challenge: DailyChallenge;

  // CASCADE: deleting a question erases its history rows — a deleted
  // question can't repeat anyway, and deletion is already blocked while
  // the question sits in TODAY's challenge
  @ManyToOne(() => Question, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    eager: true,
  })
  question: Question;
}
