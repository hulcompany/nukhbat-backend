import { UUID } from 'crypto';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { School } from '../../school/entity/school.entity';
import { Lesson } from '../../curriculum';

@Entity()
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;
  @Column('text')
  name: string;

  @Column('text')
  text: string;

  @ManyToOne(() => School, (v) => v.id, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  school: UUID | School;

  @ManyToOne(() => Lesson, { eager: true } )
  lesson: Lesson;

  @RelationId((o: Book) => o.lesson)
  lessonId: UUID;
}
