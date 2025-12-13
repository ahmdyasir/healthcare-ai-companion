import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        throw new WsException('No token provided');
      }
      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new WsException('User not found');
      }
      client.data.user = user;
      console.log(`Client connected: ${client.id}, User: ${user.email}`);
    } catch (error) {
      console.log(`Connection rejected: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(client: Socket, payload: { message: string, conversationId?: string }) {
    const user = client.data.user;
    if (!user) {
      client.emit('error', 'Unauthorized');
      return;
    }

    // 1. Save user message
    const savedMsg = await this.chatService.saveMessage('user', payload.message, user, payload.conversationId);
    
    const conversationId = savedMsg.conversation.id;
    
    // Notify client of the conversation ID (useful if it was just created)
    client.emit('conversationId', conversationId);

    // 2. Stream AI response
    await this.chatService.generateStreamedResponse(payload.message, user, conversationId, (chunk) => {
      client.emit('receiveMessage', chunk);
    });
  }
}
