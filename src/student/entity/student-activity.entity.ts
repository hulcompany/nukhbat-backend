import { UUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentProfile } from './student-profile.entity';

@Entity()
@Index(['studentId', 'date'], { unique: true })
export class StudentActivity {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;

  @Column('uuid')
  studentId: UUID;

  @ManyToOne(() => StudentProfile)
  student: StudentProfile;

  // يوم النشاط (فتح التطبيق / attendance)
  @Column({ type: 'date' })
  date: Date;

  @CreateDateColumn()
  createdAt: Date;
}
