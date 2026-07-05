import { UUID } from 'crypto';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { School } from '../../../school/entity/school.entity';

@Entity()
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;
  @Column('text')
  name: string;

  @Column('uuid')
  attachment: UUID;
  @ManyToOne(() => School, (v) => v.id, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  school: UUID | School;
}
