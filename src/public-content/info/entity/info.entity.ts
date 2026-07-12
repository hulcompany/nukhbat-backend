import { UUID } from 'crypto';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Info {
  @PrimaryGeneratedColumn('uuid')
  id: UUID;
  @Column('text', { nullable: true })
  googlePlay?: string;
  @Column('text', { nullable: true })
  appStore?: string;
  @Column('text', { nullable: true })
  phone?: string;
  @Column('text', { nullable: true })
  location?: string;
  @Column('json', { nullable: true })
  position?: { lat: number; lng: number };
  @Column('text', { nullable: true })
  about?: string;
  @Column('text', { nullable: true })
  privacyPolicy?: string;
  @Column('text', { nullable: true })
  termsAndConditions?: string;
}
