'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

export default function ChatInterface() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Socket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to backend');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from backend');
    });

    // Listen for incoming streamed chunks
    newSocket.on('receiveMessage', (chunk: string) => {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        
        // If the last message is from assistant, append to it
        if (lastMsg && lastMsg.role === 'assistant') {
          const updatedMsg = { ...lastMsg, content: lastMsg.content + chunk };
          return [...prev.slice(0, -1), updatedMsg];
        } 
        // Otherwise, start a new assistant message
        else {
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'assistant',
              content: chunk,
              createdAt: new Date(),
            },
          ];
        }
      });
    });

    // Load initial history
    fetch('http://localhost:3001/chat')
      .then((res) => res.json())
      .then((data) => {
        setMessages(data);
      })
      .catch((err) => console.error('Failed to load chat history:', err));

    return () => {
      newSocket.close();
    };
  }, []);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !socket) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      createdAt: new Date(),
    };

    // Optimistically add user message
    setMessages((prev) => [...prev, userMsg]);
    
    // Emit to backend
    socket.emit('sendMessage', { message: inputValue });
    
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 text-white flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-400" />
          Healthcare AI Companion
        </h1>
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} title={isConnected ? 'Connected' : 'Disconnected'} />
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-none shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-1 opacity-70 text-xs">
                {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                <span>{msg.role === 'user' ? 'You' : 'AI Assistant'}</span>
              </div>
              <div className="prose prose-sm max-w-none prose-invert">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your health question..."
            className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={!isConnected || !inputValue.trim()}
            className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
