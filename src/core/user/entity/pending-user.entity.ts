// import { Exclude, Expose } from 'class-transformer';
// import { UUID } from 'crypto';
// import {
//   Column,
//   Entity,
//   PrimaryGeneratedColumn,
// } from 'typeorm';
// import { RoleType } from '../../role/enum/role.type';

// @Entity()
// export class PendingUser {
//   @PrimaryGeneratedColumn('uuid')
//   id: UUID;

//   @Column({ type: 'varchar', length: 128 })
//   name: string;

//   @Column({ type: 'varchar', length: 255 })
//   email: string;

//   // unique across users; nullable because signup only has an email until the
//   // profile is completed (Postgres allows many NULLs in a unique index)

//   @Column({ type: 'varchar', length: 14, nullable: true })
//   phoneNumber?: string | null;

//   @Column({ type: 'varchar', length: 32 })
//   @Exclude()
//   password: string;

//   @Column({
//     type: 'enum',
//     enum: Object.values(RoleType),
//     default: RoleType.student,
//   })
//   role!: string;
// }
