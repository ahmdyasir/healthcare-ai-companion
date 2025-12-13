import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { Conversation } from './conversation.entity';
import { User } from '../users/user.entity';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import * as xlsx from 'xlsx';

@Injectable()
export class ChatService {
  private openai: OpenAI;
  // TODO: Move this to Redis or DB for multi-user support
  private currentFileContext: Map<string, string> = new Map();

  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      console.warn('GROQ_API_KEY is not set in .env file');
      // Fallback or dummy initialization
      this.openai = new OpenAI({ apiKey: 'dummy_key', baseURL: 'https://api.groq.com/openai/v1' });
    } else {
      this.openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.groq.com/openai/v1', // Using Groq for free inference
      });
    }
  }

  async processExcelFile(buffer: Buffer, userId: string): Promise<string> {
    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
    
    // Convert JSON to a readable string context
    this.currentFileContext.set(userId, JSON.stringify(jsonData, null, 2));
    
    // Create a summary message
    const summary = `I have analyzed the uploaded Excel file. It contains ${jsonData.length} rows of data. You can now ask me questions about it.`;
    
    // Save system message about the file
    // We need to fetch the user entity first or just pass the ID if we change saveMessage
    // For now, let's assume the caller handles the system message or we update saveMessage to take ID
    
    return summary;
  }

  async createConversation(user: User, title: string = 'New Chat'): Promise<Conversation> {
    const conversation = this.conversationRepository.create({ user, title });
    return this.conversationRepository.save(conversation);
  }

  async getUserConversations(user: User): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: { user: { id: user.id } },
      order: { updatedAt: 'DESC' },
    });
  }

  async getConversationMessages(conversationId: string, user: User): Promise<Chat[]> {
    // Ensure user owns the conversation
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, user: { id: user.id } },
    });
    if (!conversation) return [];

    return this.chatRepository.find({
      where: { conversation: { id: conversationId } },
      order: { createdAt: 'ASC' },
    });
  }

  async saveMessage(role: 'user' | 'assistant' | 'system', content: string, user: User, conversationId?: string): Promise<Chat> {
    let conversation: Conversation | null = null;
    
    if (conversationId) {
      // Ensure the conversation belongs to the user
      conversation = await this.conversationRepository.findOne({ 
        where: { id: conversationId, user: { id: user.id } } 
      });
    }
    
    if (!conversation) {
      // Create new conversation if none exists or ID is invalid
      // Use first few words of message as title if user message
      const title = role === 'user' ? content.substring(0, 30) + '...' : 'New Chat';
      conversation = await this.createConversation(user, title);
    } else {
      // Update timestamp
      conversation.updatedAt = new Date();
      await this.conversationRepository.save(conversation);
    }

    const chat = this.chatRepository.create({ role, content, user, conversation });
    return this.chatRepository.save(chat);
  }

  async getAllMessages(user: User): Promise<Chat[]> {
    // Deprecated: Use getConversationMessages
    return this.chatRepository.find({ 
      where: { user: { id: user.id } },
      order: { createdAt: 'ASC' } 
    });
  }

  async generateStreamedResponse(prompt: string, user: User, conversationId: string, onChunk: (chunk: string) => void): Promise<void> {
    try {
      let finalPrompt = prompt;
      
      const userContext = this.currentFileContext.get(user.id);
      if (userContext) {
        finalPrompt = `Here is the data from the uploaded Excel file:\n${userContext}\n\nUser Question: ${prompt}`;
      }

      const stream = await this.openai.chat.completions.create({
        model: 'llama3-70b-8192', // Free, fast, and very capable model on Groq
        messages: [
          { role: 'system', content: 'You are a helpful healthcare AI companion. Provide accurate, empathetic health info. Always advise consulting a doctor.' },
          { role: 'user', content: finalPrompt }
        ],
        stream: true,
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }

      await this.saveMessage('assistant', fullResponse, user, conversationId);
    } catch (error) {
      console.error('AI Service Error:', error.message);
      
      const errorMessage = "I'm sorry, I encountered an error connecting to the AI service. Please try again later.";
      onChunk(errorMessage);
      await this.saveMessage('assistant', errorMessage, user, conversationId);
    }
  }
}
