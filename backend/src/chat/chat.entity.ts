import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  role: 'user' | 'assistant' | 'system';

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
