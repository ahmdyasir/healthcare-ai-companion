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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { token, logout, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarOpen');
    if (savedState !== null) {
      setIsSidebarOpen(savedState === 'true');
    } else {
      // Default to open on large screens, closed on small
      setIsSidebarOpen(window.innerWidth >= 768);
    }
  }, []);

  // Save sidebar state
  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    localStorage.setItem('sidebarOpen', String(newState));
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

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

  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center bg-zinc-900 text-white">Loading...</div>;
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen w-full bg-zinc-900 text-gray-100 overflow-hidden">
      <Sidebar 
        currentConversationId={currentConversationId}
        onSelectConversation={setCurrentConversationId}
        onNewChat={() => setCurrentConversationId(null)}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className="flex-1 flex flex-col h-full relative w-full transition-all duration-300 ease-in-out">
        {/* Header */}
        <div className="bg-zinc-900 border-b border-zinc-800 p-4 text-white flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleSidebar}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer hover:bg-zinc-800 p-2 rounded-md"
              title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="w-8 h-8" />
              <span className="hidden sm:inline">Mantra </span>
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
        <div className="flex-1 overflow-y-auto bg-zinc-900 scroll-smooth">
          <div className="flex flex-col items-center pb-32">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500">
                <div className="">
                  <Image src="/logo.png" alt="Logo" width={100} height={100} className="w-30 h-30" />
                </div>
                <p className="text-lg font-medium">How can I help you today?</p>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`w-full border-b border-black/10 dark:border-gray-900/50 ${
                  msg.role === 'assistant' ? 'bg-zinc-900' : 'bg-zinc-900'
                }`}
              >
                <div className={`max-w-3xl mx-auto p-4 md:p-6 flex gap-4 md:gap-6 ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}>
                  <div className="shrink-0 flex flex-col relative items-end">
                    <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
                      msg.role === 'user' ? 'bg-indigo-500' : 'bg-green-500'
                    }`}>
                      {msg.role === 'user' ? <User size={20} className="text-white" /> : <Bot size={20} className="text-white" />}
                    </div>
                  </div>
                  <div className={`relative flex-1 overflow-hidden ${
                    msg.role === 'user' ? 'text-right' : ''
                  }`}>
                    <div className="font-bold text-sm mb-1 opacity-90">
                      {msg.role === 'user' ? 'You' : 'AI Assistant'}
                    </div>
                    <div className="prose prose-invert max-w-none leading-7">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-zinc-900 via-zinc-900 to-transparent pt-10 pb-6 px-4">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative">
            <div className="relative flex items-center w-full p-3 bg-zinc-700/50 border border-zinc-600 rounded-xl shadow-lg focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 transition-all">
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
                className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                title="Upload Excel File"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Send a message..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-400 px-3 py-1 min-w-0"
              />
              
              <button
                type="submit"
                disabled={!isConnected || !inputValue.trim()}
                className={`p-2 rounded-md transition-colors ${
                  inputValue.trim() 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-transparent text-gray-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center mt-2 text-xs text-gray-500">
              Mantra can make mistakes. Consider checking important information.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
