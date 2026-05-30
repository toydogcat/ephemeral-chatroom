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
  FileVideo,
  Presentation,
  Trash2,
  Megaphone,
  Laptop
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
  onMuteGuest?: (targetId: string) => void;
  // 電子白板大屏幕新增 Props
  presentation?: { contentType: string; contentData: string; name?: string } | null;
  onBroadcastPresentation?: (contentType: string, contentData: string, name?: string) => void;
  onClearPresentation?: () => void;
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
  onMuteGuest,
  presentation = null,
  onBroadcastPresentation,
  onClearPresentation,
}) => {
  const [inputText, setInputText] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [isSendingFile, setIsSendingFile] = useState(false);
  
  // 手機響應式 Tab 狀態 ('chat' | 'board')
  const [activeTab, setActiveTab] = useState<'chat' | 'board'>('chat');
  const [hasNewPresentation, setHasNewPresentation] = useState(false);

  // 老師教材廣播相關狀態
  const [announcementText, setAnnouncementText] = useState('');
  const [isBroadcastingFile, setIsBroadcastingFile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presentationFileInputRef = useRef<HTMLInputElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const isMeHost = players.find((p) => p.id === myId)?.isHost || false;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const [prevPresentation, setPrevPresentation] = useState(presentation);

  // 當 presentation prop 改變時，直接在渲染中調整狀態，避免 useEffect 級聯渲染 ESLint 警告
  if (presentation !== prevPresentation) {
    setPrevPresentation(presentation);
    if (presentation && activeTab === 'chat') {
      setHasNewPresentation(true);
    }
  }

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(err => {
        console.warn('Audio auto-play failed:', err);
      });
    }
  }, [remoteStream]);

  const handleTabChange = (tab: 'chat' | 'board') => {
    setActiveTab(tab);
    if (tab === 'board') {
      setHasNewPresentation(false);
    }
  };

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

    if (file.size > 10 * 1024 * 1024) {
      alert('為了傳輸穩定性，P2P 傳送檔案上限為 10MB！');
      return;
    }

    try {
      setIsSendingFile(true);
      await onSendFile(file);
      setTimeout(() => {
        setIsSendingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 500);
    } catch (err) {
      console.error(err);
      setIsSendingFile(false);
    }
  };

  // 老師廣播大屏幕教材
  const handlePresentationFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onBroadcastPresentation) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('教材廣播上限為 10MB，以確保全班同步速度！');
      return;
    }

    try {
      setIsBroadcastingFile(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        onBroadcastPresentation(file.type, base64Data, file.name);
        setIsBroadcastingFile(false);
        if (presentationFileInputRef.current) presentationFileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsBroadcastingFile(false);
    }
  };

  const handleBroadcastAnnouncement = () => {
    if (announcementText.trim() && onBroadcastPresentation) {
      onBroadcastPresentation('announcement', announcementText.trim());
      setAnnouncementText('');
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
            <div className="text-[10px] text-zinc-400 dark:text-zinc-505 flex items-center justify-between gap-4 mt-1">
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
        return (
          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl max-w-sm w-72">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{msg.fileName}</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-505">{formatBytes(msg.fileSize)}</p>
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

  const renderPresentationContent = () => {
    if (!presentation) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-8 space-y-6 max-w-lg animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 animate-pulse border border-zinc-800 shadow-inner">
            <Laptop size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-zinc-250">歡迎來到 P2P 虛擬教室</h3>
            <p className="text-xs text-zinc-500 leading-relaxed px-4">
              這裡是大屏幕展示區。當老師（房主）推送課堂教材、大圖片、影片或課堂公告時，螢幕將在 0.1 秒內自動完成全班即時畫面同步！
            </p>
          </div>
        </div>
      );
    }

    const type = presentation.contentType;

    if (type === 'announcement') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-tr from-indigo-950 via-purple-950 to-pink-900 text-white animate-fade-in relative overflow-hidden select-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
          
          <div className="max-w-2xl text-center space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-[9px] font-black uppercase tracking-widest text-pink-350 shadow-md">
              <Megaphone size={12} /> 課堂公告
            </div>
            <h2 className="text-2xl md:text-4xl font-extrabold tracking-wide leading-relaxed drop-shadow-md break-words px-2">
              {presentation.contentData}
            </h2>
          </div>
        </div>
      );
    }

    if (type.startsWith('image/')) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 animate-fade-in bg-zinc-950">
          <img
            src={presentation.contentData}
            alt={presentation.name || 'Shared Media'}
            className="max-w-[95%] max-h-[70vh] object-contain rounded-2xl shadow-2xl border border-white/5 bg-zinc-900"
          />
          {presentation.name && (
            <div className="mt-3 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-medium text-zinc-400 flex items-center gap-1.5 shadow-md">
              <Laptop size={12} className="text-blue-500 animate-pulse" />
              <span className="truncate max-w-[200px]">老師分享的圖片：{presentation.name}</span>
            </div>
          )}
        </div>
      );
    }

    if (type.startsWith('audio/')) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-100 animate-fade-in">
          <div className="w-36 h-36 rounded-full bg-blue-900/20 border border-blue-500/20 flex items-center justify-center mb-6 relative">
            <span className="absolute inset-0 rounded-full bg-blue-500/5 animate-ping"></span>
            <FileAudio size={48} className="text-blue-500" />
          </div>
          <div className="max-w-xs w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
            <p className="text-xs font-bold text-center text-zinc-300 truncate">{presentation.name || '老師分享的音訊教材'}</p>
            <audio src={presentation.contentData} controls autoPlay className="w-full h-10" />
          </div>
        </div>
      );
    }

    if (type.startsWith('video/')) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-zinc-950 text-zinc-100 animate-fade-in">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-3 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
              <span className="font-bold text-zinc-350 truncate max-w-[200px]">🎬 播放影片：{presentation.name}</span>
              <span className="px-2 py-0.5 bg-red-950/60 text-red-400 rounded-full font-bold border border-red-900/40 scale-90">教學模式</span>
            </div>
            <video src={presentation.contentData} controls autoPlay className="w-full rounded-xl bg-black max-h-[55vh] shadow-inner" />
          </div>
        </div>
      );
    }

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-100 animate-fade-in">
        <div className="flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full shadow-xl">
          <div className="p-3 bg-blue-900/30 border border-blue-500/20 text-blue-400 rounded-xl">
            <FileText size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-zinc-300 text-xs truncate">{presentation.name}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">老師廣播的課堂講義</p>
          </div>
          <a
            href={presentation.contentData}
            download={presentation.name}
            className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-bold text-[10px]"
          >
            下載教材
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="flex md:flex-row flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <audio ref={remoteAudioRef} autoPlay />

      {/* ─── 左側欄：聊天室與成員 (響應式手機顯隱) ─── */}
      <aside className={`w-full md:w-96 flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-850 shrink-0 shadow-lg relative z-20 ${activeTab === 'chat' ? 'flex' : 'hidden'} md:flex`}>
        {/* Left Header */}
        <header className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-850 shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-md shadow-blue-600/20">
              {roomId.substring(0, 2)}
            </div>
            <div>
              <h2 className="font-bold text-xs truncate max-w-[90px]">教室 #{roomId}</h2>
              <div className="flex items-center gap-1 text-[8px] text-zinc-500">
                <span className={`w-1 h-1 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></span>
                {isConnected ? '已建立 P2P 直連' : '連線中...'}
              </div>
            </div>
          </div>

          {/* 手機端專屬 Tab 切換開關 */}
          <div className="flex md:hidden bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-full border border-zinc-200/50 dark:border-zinc-700/60 max-w-[130px] shrink-0 mx-1">
            <button
              type="button"
              onClick={() => handleTabChange('chat')}
              className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-650'
              }`}
            >
              💬 聊天
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('board')}
              className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider transition-all relative cursor-pointer ${
                activeTab === 'board'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-650'
              }`}
            >
              💻 白板
              {hasNewPresentation && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-zinc-900 animate-pulse"></span>
              )}
            </button>
          </div>

          <div className="flex gap-1">
            {/* 麥克風語音按鈕 */}
            {onToggleVoice && (
              <button
                onClick={onToggleVoice}
                disabled={!isConnected}
                className={`p-1.5 rounded-full transition-all relative ${
                  !isConnected
                    ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
                    : isVoiceActive
                    ? 'bg-green-500 text-white shadow-md shadow-green-500/30'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-550 dark:text-zinc-350'
                }`}
                title={isVoiceActive ? '關閉我的麥克風' : '開啟語音說話'}
              >
                {isVoiceActive ? <Mic size={15} className="animate-pulse" /> : <MicOff size={15} />}
              </button>
            )}

            {/* QRCode / 邀請 */}
            <button
              onClick={() => setShowQRCode(!showQRCode)}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-550 dark:text-zinc-350"
              title="邀請好友"
            >
              <Users size={15} />
            </button>
          </div>
        </header>

        {/* QR Code Modal */}
        {showQRCode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="relative">
              <button
                onClick={() => setShowQRCode(false)}
                className="absolute -top-2 -right-2 w-8 h-8 bg-zinc-850 hover:bg-zinc-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors font-bold text-sm"
              >
                ✕
              </button>
              <RoomQRCode roomId={roomId} />
            </div>
          </div>
        )}

        {/* 語音狀態波形 */}
        {isVoiceActive && isConnected && (
          <div className="bg-green-50 dark:bg-green-950/20 border-b border-green-100 dark:border-green-900/30 px-3 py-1.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-green-700 dark:text-green-400">
              <span className="flex gap-0.5 items-end h-2.5 w-3 shrink-0">
                <span className="bg-green-500 w-[1.5px] rounded-full animate-bounce [animation-delay:0.1s] h-1 animate-infinite"></span>
                <span className="bg-green-500 w-[1.5px] rounded-full animate-bounce [animation-delay:0.3s] h-2.5 animate-infinite"></span>
                <span className="bg-green-500 w-[1.5px] rounded-full animate-bounce [animation-delay:0.2s] h-1.5 animate-infinite"></span>
              </span>
              <span>麥克風通話中...</span>
            </div>
          </div>
        )}

        {/* 聊天訊息區 */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950/40">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-650 space-y-1.5 opacity-60">
              <MessageCircle size={28} className="animate-pulse" />
              <p className="font-semibold text-[10px]">開始暢所欲言，教學免伺服器直連！</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === myId;
              const isFile = msg.type === 'file';
              
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in`}>
                  <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[8px] text-zinc-500 mb-0.5 px-1 font-bold">{msg.senderName}</span>
                    <div
                      className={`rounded-2xl shadow-sm text-xs transition-all ${
                        isFile
                          ? isMe
                            ? 'bg-blue-50 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 border border-blue-200/50 dark:border-zinc-700/60 p-2 rounded-tr-none'
                            : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 p-2 rounded-tl-none'
                          : isMe
                          ? 'bg-blue-600 text-white rounded-tr-none px-3 py-1.5'
                          : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-tl-none px-3 py-1.5'
                      }`}
                    >
                      {renderMessageContent(msg)}
                    </div>
                    <span className="text-[7px] text-zinc-400 dark:text-zinc-550 mt-0.5 px-1">
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
        <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 flex gap-1 overflow-x-auto no-scrollbar shrink-0">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 whitespace-nowrap text-[9px] shrink-0 font-medium shadow-sm"
            >
              {p.isHost && <Shield size={9} className="text-blue-500 shrink-0" />}
              <span>{p.name}</span>
              {p.id === myId && <span className="text-zinc-400 font-normal ml-0.5">(我)</span>}

              {/* 房主專屬禁言按鈕 */}
              {isMeHost && p.id !== myId && !p.isHost && onMuteGuest && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`確定要將學生「${p.name}」靜音嗎？`)) {
                      onMuteGuest(p.id);
                    }
                  }}
                  className="ml-1 p-0.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 hover:text-red-650 rounded transition-colors shrink-0 cursor-pointer"
                  title="強制禁言"
                >
                  <MicOff size={8} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Input Area */}
        <footer className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <form onSubmit={handleSend} className="flex gap-1.5 items-center">
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
                  className={`p-2 rounded-full transition-all shrink-0 ${
                    !isConnected || isSendingFile
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                      : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-650 dark:text-zinc-300'
                  }`}
                  title="傳送檔案 (最大 10MB)"
                >
                  {isSendingFile ? (
                    <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Paperclip size={15} />
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
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-none rounded-full px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs font-medium"
            />
            
            <button
              type="submit"
              disabled={!inputText.trim() || !isConnected || isSendingFile}
              className={`p-2 rounded-full transition-all shrink-0 ${
                inputText.trim() && isConnected && !isSendingFile
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:scale-105'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
              }`}
            >
              <Send size={15} />
            </button>
          </form>
        </footer>
      </aside>

      {/* ─── 右側欄：大白板大畫面 (手機端響應式顯隱) ─── */}
      <section className={`flex-1 h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden relative ${activeTab === 'board' ? 'flex' : 'hidden'} md:flex`}>
        {/* Right Header Status Bar */}
        <header className="px-4 py-3 bg-zinc-900/60 backdrop-blur-md border-b border-zinc-850 shrink-0 flex items-center justify-between z-10 shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Presentation size={15} />
            </div>
            <div>
              <h2 className="font-extrabold text-xs tracking-wider text-zinc-250 flex items-center gap-1">
                電子大屏幕
                <span className="px-1.5 py-0.5 text-[8px] font-black bg-zinc-800 text-zinc-400 rounded border border-zinc-700">P2P 同步</span>
              </h2>
            </div>
          </div>

          {/* 手機端專屬 Tab 切換開關 (大白板頁面時亦可隨時切回聊天) */}
          <div className="flex md:hidden bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-full border border-zinc-200/50 dark:border-zinc-700/60 max-w-[130px] shrink-0 mx-1">
            <button
              type="button"
              onClick={() => handleTabChange('chat')}
              className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-650'
              }`}
            >
              💬 聊天
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('board')}
              className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider transition-all relative cursor-pointer ${
                activeTab === 'board'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-650'
              }`}
            >
              💻 白板
              {hasNewPresentation && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-zinc-900 animate-pulse"></span>
              )}
            </button>
          </div>
          
          <div className="hidden sm:flex items-center gap-4 text-[10px] font-semibold text-zinc-450">
            {presentation ? (
              <span className="flex items-center gap-1 text-green-400 bg-green-950/40 border border-green-900/30 px-2 py-0.5 rounded-full">
                <span className="w-1 h-1 rounded-full bg-green-500 animate-ping"></span>
                老師廣播中
              </span>
            ) : (
              <span className="text-zinc-500 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-zinc-650"></span>
                靜置中
              </span>
            )}
          </div>
        </header>

        {/* 主要展示大屏幕白板區 */}
        <div className="flex-1 overflow-auto flex items-center justify-center relative">
          {renderPresentationContent()}
        </div>

        {/* 老師教材廣播控制台 (僅 Host 可見，圓角浮動微卡片) */}
        {isMeHost && onBroadcastPresentation && (
          <div className="p-3.5 bg-zinc-900/80 backdrop-blur-md border-t border-zinc-800 flex flex-col gap-2.5 shrink-0 relative z-10 shadow-2xl">
            <div className="flex items-center justify-between text-[10px] text-zinc-450 font-bold border-b border-zinc-800/80 pb-1.5 mb-0.5">
              <span className="flex items-center gap-1 text-indigo-400">
                <Laptop size={12} /> 教材推播控制台
              </span>
              <span className="hidden sm:inline text-[9px] text-zinc-500 font-normal">
                實時推播公告與多媒體教材，同步至全班學生的右側大屏幕！
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* 公告輸入廣播 */}
              <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-full px-3 py-1">
                <Megaphone size={12} className="text-pink-400 shrink-0 ml-0.5" />
                <input
                  type="text"
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="輸入隨堂公告推播..."
                  className="flex-1 bg-transparent border-none outline-none text-[10px] text-zinc-200 py-0.5"
                />
                <button
                  type="button"
                  onClick={handleBroadcastAnnouncement}
                  disabled={!announcementText.trim() || !isConnected}
                  className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold transition-all cursor-pointer ${
                    announcementText.trim() && isConnected
                      ? 'bg-pink-600 hover:bg-pink-500 text-white shadow-md shadow-pink-600/20'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  廣播
                </button>
              </div>

              {/* 教材大檔案廣播 */}
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="file"
                  ref={presentationFileInputRef}
                  onChange={handlePresentationFileChange}
                  className="hidden"
                  accept="image/*,audio/*,video/*,.pdf,.zip,.rar,.txt"
                />
                <button
                  type="button"
                  disabled={!isConnected || isBroadcastingFile}
                  onClick={() => presentationFileInputRef.current?.click()}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    !isConnected || isBroadcastingFile
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                  }`}
                  title="推播影音圖片教材 (最大 10MB)"
                >
                  {isBroadcastingFile ? (
                    <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Paperclip size={12} />
                  )}
                  <span>推播教材</span>
                </button>

                {/* 清屏按鈕 */}
                {presentation && onClearPresentation && (
                  <button
                    type="button"
                    onClick={onClearPresentation}
                    className="px-3 py-1.5 bg-red-950/40 hover:bg-red-950 border border-red-900/50 hover:border-red-700 text-red-400 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title="清空學生端大白板"
                  >
                    <Trash2 size={12} />
                    <span>清空</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
