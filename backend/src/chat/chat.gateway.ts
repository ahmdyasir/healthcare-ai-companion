import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(client: Socket, payload: { message: string }) {
    // 1. Save user message
    await this.chatService.saveMessage('user', payload.message);

    // 2. Stream AI response
    // We'll implement the streaming logic in the service and emit events back to this client
    await this.chatService.generateStreamedResponse(payload.message, (chunk) => {
      client.emit('receiveMessage', chunk);
    });
  }
}
