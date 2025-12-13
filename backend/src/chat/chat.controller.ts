import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { Chat } from './chat.entity';
import { Conversation } from './conversation.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  async getConversations(@Request() req): Promise<Conversation[]> {
    return this.chatService.getUserConversations(req.user);
  }

  @Post('conversations')
  async createConversation(@Request() req): Promise<Conversation> {
    return this.chatService.createConversation(req.user);
  }

  @Get('conversations/:id')
  async getConversationMessages(@Request() req, @Param('id') id: string): Promise<Chat[]> {
    return this.chatService.getConversationMessages(id, req.user);
  }

  @Get()
  async getMessages(@Request() req): Promise<Chat[]> {
    return this.chatService.getAllMessages(req.user);
  }
}
