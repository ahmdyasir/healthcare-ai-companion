import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { UploadController } from './upload.controller';
import { ChatService } from './chat.service';
import { Chat } from './chat.entity';
import { Conversation } from './conversation.entity';
import { ChatGateway } from './chat.gateway';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, Conversation]),
    ConfigModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [ChatController, UploadController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
