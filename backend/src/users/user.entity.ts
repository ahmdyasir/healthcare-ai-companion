import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn } from 'typeorm';
import { Chat } from '../chat/chat.entity';
import { Conversation } from '../chat/conversation.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  name: string;

  @OneToMany(() => Chat, (chat) => chat.user)
  chats: Chat[];

  @OneToMany(() => Conversation, (conversation) => conversation.user)
  conversations: Conversation[];

  @CreateDateColumn()
  createdAt: Date;
}
