import React, { useState, useRef, useEffect } from 'react';
import { Send, Users, Shield, MessageCircle } from 'lucide-react';
import type { Player, ChatMessage } from '../types';
import { RoomQRCode } from './RoomQRCode';

interface ChatRoomProps {
  myId: string;
  roomId: string;
  players: Player[];
  messages: ChatMessage[];
  isConnected: boolean;
  onSendMessage: (text: string) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  myId,
  roomId,
  players,
  messages,
  isConnected,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 max-w-2xl mx-auto border-x border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
            {roomId.substring(0, 2)}
          </div>
          <div>
            <h2 className="font-bold">臨時聊天室 #{roomId}</h2>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`}></span>
              {isConnected ? 'P2P 已連線' : '建立連線中...'}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowQRCode(!showQRCode)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <Users size={20} />
          </button>
        </div>
      </header>

      {/* QR Code Modal / Overlay */}
      {showQRCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative">
            <button
              onClick={() => setShowQRCode(false)}
              className="absolute -top-2 -right-2 w-8 h-8 bg-zinc-800 text-white rounded-full flex items-center justify-center shadow-lg"
            >
              ✕
            </button>
            <RoomQRCode roomId={roomId} />
          </div>
        </div>
      )}

      {/* Message Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-2 opacity-50">
            <MessageCircle size={48} />
            <p>還沒有訊息，開始聊天吧！</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === myId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-zinc-500 mb-1 px-1">{msg.senderName}</span>
                  <div
                    className={`px-4 py-2 rounded-2xl shadow-sm ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Players List Mini */}
      <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 overflow-x-auto no-scrollbar">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 whitespace-nowrap text-xs shrink-0"
          >
            {p.isHost && <Shield size={12} className="text-blue-500" />}
            <span>{p.name}</span>
            {p.id === myId && <span className="text-zinc-400 font-normal">(我)</span>}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <footer className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="輸入訊息..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-none rounded-full px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || !isConnected}
            className={`p-2 rounded-full transition-all ${
              inputText.trim() && isConnected
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
            }`}
          >
            <Send size={20} />
          </button>
        </form>
      </footer>
    </div>
  );
};
