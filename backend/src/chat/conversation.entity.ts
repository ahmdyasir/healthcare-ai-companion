import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from '../users/user.entity';
import { Chat } from './chat.entity';

@Entity()
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'New Chat' })
  title: string;

  @ManyToOne(() => User, (user) => user.conversations)
  user: User;

  @OneToMany(() => Chat, (chat) => chat.conversation)
  messages: Chat[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
