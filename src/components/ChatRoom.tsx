import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Users,
  Shield,
  MessageCircle,
  Mic,
  MicOff,
  Paperclip,
  FileText,
  Download,
  FileAudio,
  FileVideo
} from 'lucide-react';
import type { Player, ChatMessage } from '../types';
import { RoomQRCode } from './RoomQRCode';

interface ChatRoomProps {
  myId: string;
  roomId: string;
  players: Player[];
  messages: ChatMessage[];
  isConnected: boolean;
  onSendMessage: (text: string) => void;
  onSendFile?: (file: File) => void;
  isVoiceActive?: boolean;
  remoteStream?: MediaStream | null;
  onToggleVoice?: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  myId,
  roomId,
  players,
  messages,
  isConnected,
  onSendMessage,
  onSendFile,
  isVoiceActive = false,
  remoteStream = null,
  onToggleVoice,
}) => {
  const [inputText, setInputText] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [isSendingFile, setIsSendingFile] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      // 確保自動播放
      remoteAudioRef.current.play().catch(err => {
        console.warn('Audio auto-play blocked or failed:', err);
      });
    }
  }, [remoteStream]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onSendFile) return;

    // 限制 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert('為了傳輸穩定性，P2P 傳送檔案上限為 10MB！');
      return;
    }

    try {
      setIsSendingFile(true);
      await onSendFile(file);
      // 給予極短暫的 Loading 動態感，提升體驗
      setTimeout(() => {
        setIsSendingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 500);
    } catch (err) {
      console.error(err);
      setIsSendingFile(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.type === 'file' && msg.fileData) {
      const type = msg.fileType || '';
      
      if (type.startsWith('image/')) {
        return (
          <div className="space-y-1">
            <img
              src={msg.fileData}
              alt={msg.fileName}
              className="max-w-full rounded-lg max-h-72 object-contain bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 cursor-zoom-in"
              onClick={() => {
                const w = window.open();
                w?.document.write(`<img src="${msg.fileData}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
              }}
            />
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center justify-between gap-4 mt-1">
              <span className="truncate max-w-[150px]">{msg.fileName}</span>
              <span>{formatBytes(msg.fileSize)}</span>
            </div>
          </div>
        );
      } else if (type.startsWith('audio/')) {
        return (
          <div className="space-y-2 w-72 max-w-full">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              <FileAudio size={16} className="text-blue-500 shrink-0" />
              <span className="truncate flex-1">{msg.fileName}</span>
            </div>
            <audio src={msg.fileData} controls className="w-full h-8" />
            <span className="text-[10px] text-zinc-400 block">{formatBytes(msg.fileSize)}</span>
          </div>
        );
      } else if (type.startsWith('video/')) {
        return (
          <div className="space-y-2 w-80 max-w-full">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              <FileVideo size={16} className="text-red-500 shrink-0" />
              <span className="truncate flex-1">{msg.fileName}</span>
            </div>
            <video src={msg.fileData} controls className="w-full rounded-lg bg-black max-h-48" />
            <span className="text-[10px] text-zinc-400 block">{formatBytes(msg.fileSize)}</span>
          </div>
        );
      } else {
        // 一般文件卡片
        return (
          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl max-w-sm w-72">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{msg.fileName}</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">{formatBytes(msg.fileSize)}</p>
            </div>
            <a
              href={msg.fileData}
              download={msg.fileName}
              className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 transition-colors shrink-0"
              title="下載檔案"
            >
              <Download size={18} />
            </a>
          </div>
        );
      }
    }

    return <span>{msg.text}</span>;
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 max-w-2xl mx-auto border-x border-zinc-200 dark:border-zinc-800">
      {/* 隱藏的遠端語音播放 */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
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
          {/* 語音通話 (說話) 按鈕 */}
          {onToggleVoice && (
            <button
              onClick={onToggleVoice}
              disabled={!isConnected}
              className={`p-2 rounded-full transition-all relative ${
                !isConnected
                  ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
                  : isVoiceActive
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/40 border border-green-400'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
              }`}
              title={isVoiceActive ? '關閉語音通話' : '開啟語音通話'}
            >
              {isVoiceActive ? (
                <>
                  <Mic size={20} className="animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                </>
              ) : (
                <MicOff size={20} />
              )}
            </button>
          )}

          {/* QRCode / 邀請好友按鈕 */}
          <button
            onClick={() => setShowQRCode(!showQRCode)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-600 dark:text-zinc-300"
            title="邀請好友"
          >
            <Users size={20} />
          </button>
        </div>
      </header>

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative">
            <button
              onClick={() => setShowQRCode(false)}
              className="absolute -top-2 -right-2 w-8 h-8 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors font-bold"
            >
              ✕
            </button>
            <RoomQRCode roomId={roomId} />
          </div>
        </div>
      )}

      {/* 語音通話動態提示 */}
      {isVoiceActive && isConnected && (
        <div className="bg-green-50 dark:bg-green-950/40 border-b border-green-100 dark:border-green-900/50 px-4 py-2 flex items-center justify-between shrink-0 animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-green-700 dark:text-green-400">
            <span className="flex gap-0.5 items-end h-3 w-4 shrink-0">
              <span className="bg-green-500 w-[2px] rounded-full animate-bounce [animation-delay:0.1s] h-1.5"></span>
              <span className="bg-green-500 w-[2px] rounded-full animate-bounce [animation-delay:0.3s] h-3"></span>
              <span className="bg-green-500 w-[2px] rounded-full animate-bounce [animation-delay:0.2s] h-2"></span>
              <span className="bg-green-500 w-[2px] rounded-full animate-bounce [animation-delay:0.4s] h-2.5"></span>
            </span>
            <span>P2P 語音通話進行中，已開啟麥克風</span>
          </div>
          {remoteStream && (
            <span className="text-[10px] bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-300 px-2 py-0.5 rounded-full font-semibold">
              已建立音軌直連
            </span>
          )}
        </div>
      )}

      {/* Message Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-600 space-y-2 opacity-60">
            <MessageCircle size={48} className="animate-pulse" />
            <p className="font-medium text-sm">還沒有訊息，開始聊天吧！</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === myId;
            const isFile = msg.type === 'file';
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in`}>
                <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-zinc-500 mb-1 px-1 font-semibold">{msg.senderName}</span>
                  <div
                    className={`rounded-2xl shadow-sm transition-all ${
                      isFile
                        ? isMe
                          ? 'bg-blue-50 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 border border-blue-200 dark:border-zinc-700 p-2 rounded-tr-none'
                          : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 p-2 rounded-tl-none'
                        : isMe
                        ? 'bg-blue-600 text-white rounded-tr-none px-4 py-2'
                        : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-tl-none px-4 py-2'
                    }`}
                  >
                    {renderMessageContent(msg)}
                  </div>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 px-1">
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
      <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-850 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 whitespace-nowrap text-xs shrink-0 font-medium shadow-sm"
          >
            {p.isHost && <Shield size={12} className="text-blue-500 shrink-0" />}
            <span>{p.name}</span>
            {p.id === myId && <span className="text-zinc-400 font-normal ml-0.5">(我)</span>}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <footer className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
        <form onSubmit={handleSend} className="flex gap-2 items-center">
          {/* 隱藏的 File Input */}
          {onSendFile && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,audio/*,video/*,.pdf,.zip,.rar,.txt,.doc,.docx,.xls,.xlsx"
              />
              <button
                type="button"
                disabled={!isConnected || isSendingFile}
                onClick={() => fileInputRef.current?.click()}
                className={`p-2.5 rounded-full transition-all shrink-0 ${
                  !isConnected || isSendingFile
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                    : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                }`}
                title="傳送檔案 (最大 10MB)"
              >
                {isSendingFile ? (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Paperclip size={20} />
                )}
              </button>
            </>
          )}

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isSendingFile ? '檔案傳送中...' : '輸入訊息...'}
            disabled={isSendingFile}
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-none rounded-full px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
          />
          
          <button
            type="submit"
            disabled={!inputText.trim() || !isConnected || isSendingFile}
            className={`p-2.5 rounded-full transition-all shrink-0 ${
              inputText.trim() && isConnected && !isSendingFile
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105'
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
