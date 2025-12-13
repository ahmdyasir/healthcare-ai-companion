'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, User, Bot, Paperclip, LogOut, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';

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
  const [isUploading, setIsUploading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { token, logout, isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Socket connection
  useEffect(() => {
    if (!token) return;

    const newSocket = io('http://localhost:3001', {
      auth: {
        token: token
      }
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to backend');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from backend');
    });

    newSocket.on('error', (err) => {
      console.error('Socket error:', err);
      if (err === 'Unauthorized') {
        logout();
      }
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

    // Listen for conversation ID updates (e.g. when a new chat is created)
    newSocket.on('conversationId', (id: string) => {
      if (currentConversationId !== id) {
        setCurrentConversationId(id);
      }
    });

    return () => {
      newSocket.close();
    };
  }, [token, logout, currentConversationId]);

  // Load chat history when conversation changes
  useEffect(() => {
    if (!token) return;

    if (!currentConversationId) {
      setMessages([]);
      return;
    }

    fetch(`http://localhost:3001/chat/conversations/${currentConversationId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then((res) => {
        if (res.status === 401) {
          logout();
          throw new Error('Unauthorized');
        }
        return res.json();
      })
      .then((data) => {
        setMessages(data);
      })
      .catch((err) => console.error('Failed to load chat history:', err));
  }, [token, currentConversationId, logout]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:3001/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      
      // Add system message about upload
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'system',
          content: `File uploaded: ${file.name}. ${data.summary}`,
          createdAt: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
    
    // Emit to backend with conversationId
    socket.emit('sendMessage', { 
      message: inputValue,
      conversationId: currentConversationId 
    });
    
    setInputValue('');
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen w-full bg-gray-900 text-gray-100 overflow-hidden">
      <Sidebar 
        currentConversationId={currentConversationId}
        onSelectConversation={setCurrentConversationId}
        onNewChat={() => setCurrentConversationId(null)}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className="flex-1 flex flex-col h-full relative w-full">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-gray-400 hover:text-white"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="w-8 h-8" />
              <span className="hidden sm:inline">Healthcare AI Companion</span>
              <span className="sm:hidden">AI Companion</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} title={isConnected ? 'Connected' : 'Disconnected'} />
            <button onClick={logout} className="text-gray-400 hover:text-white" title="Logout">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
              <Bot size={48} className="mb-4" />
              <p>Start a new conversation...</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-none shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 opacity-70 text-xs">
                  {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                  <span>{msg.role === 'user' ? 'You' : 'AI Assistant'}</span>
                </div>
                <div className="prose prose-sm max-w-none prose-invert break-words">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="p-4 bg-gray-800 border-t border-gray-700 shrink-0">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".xlsx,.xls,.csv"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected || isUploading}
              className="bg-gray-700 text-gray-300 p-3 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors shrink-0"
              title="Upload Excel File"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your health question..."
              className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 min-w-0"
            />
            <button
              type="submit"
              disabled={!isConnected || !inputValue.trim()}
              className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
