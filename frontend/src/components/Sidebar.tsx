'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface SidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ currentConversationId, onSelectConversation, onNewChat, isOpen, setIsOpen }: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      fetchConversations();
    }
  }, [token, currentConversationId]); // Refresh when current conversation changes (e.g. title update)

  const fetchConversations = async () => {
    try {
      const res = await fetch('http://localhost:3001/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to fetch conversations', error);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-30
        bg-zinc-900 border-r border-zinc-800 transform transition-all duration-300 ease-in-out overflow-hidden
        ${isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-0 md:border-none'}
      `}>
        <div className="p-4 flex flex-col h-full w-64">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) setIsOpen(false);
            }}
            className="flex items-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors mb-4 cursor-pointer"
          >
            <Plus size={20} />
            <span>New Chat</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  onSelectConversation(conv.id);
                  if (window.innerWidth < 768) setIsOpen(false);
                }}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors cursor-pointer ${
                  currentConversationId === conv.id
                    ? 'bg-zinc-800 text-white'
                    : 'text-gray-400 hover:bg-zinc-800/50 hover:text-gray-200'
                }`}
              >
                <MessageSquare size={18} />
                <span className="truncate text-sm">{conv.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
