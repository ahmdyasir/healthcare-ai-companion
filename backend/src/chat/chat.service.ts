import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set in .env file');
      this.genAI = new GoogleGenerativeAI('dummy_key');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: 'You are a helpful healthcare AI companion. Provide accurate, empathetic health info. Always advise consulting a doctor.'
    });
  }

  async saveMessage(role: 'user' | 'assistant' | 'system', content: string): Promise<Chat> {
    const chat = this.chatRepository.create({ role, content });
    return this.chatRepository.save(chat);
  }

  async getAllMessages(): Promise<Chat[]> {
    return this.chatRepository.find({ order: { createdAt: 'ASC' } });
  }

  async generateStreamedResponse(prompt: string, onChunk: (chunk: string) => void): Promise<void> {
    try {
      const result = await this.model.generateContentStream(prompt);

      let fullResponse = '';

      for await (const chunk of result.stream) {
        const content = chunk.text();
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }

      await this.saveMessage('assistant', fullResponse);
    } catch (error) {
      console.error('Gemini API Error:', error.message);
      
      const errorMessage = "I'm sorry, I encountered an error connecting to the AI service. Please try again later.";
      onChunk(errorMessage);
      await this.saveMessage('assistant', errorMessage);
    }
  }
}
