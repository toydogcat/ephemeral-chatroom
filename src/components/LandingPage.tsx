import React, { useState } from 'react';
import { Plus, LogIn, MessageSquare, Shield, Zap } from 'lucide-react';

interface LandingPageProps {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (roomId: string, name: string) => void;
  joinError?: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onCreateRoom, onJoinRoom, joinError }) => {
  const [name, setName] = useState(() => localStorage.getItem('chat_player_name') || '');
  const [detectedRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room')?.toUpperCase() || null;
  });
  const [roomIdInput, setRoomIdInput] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room')?.toUpperCase() || '';
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      localStorage.setItem('chat_player_name', name);
      onCreateRoom(name);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && (roomIdInput.trim() || detectedRoomId)) {
      localStorage.setItem('chat_player_name', name);
      onJoinRoom(roomIdInput.trim() || detectedRoomId!, name);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 mb-4">
            <MessageSquare size={32} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Ephemeral Chat
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            100% 無伺服器 P2P 臨時聊天室
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-6">
          {joinError === 'nickname_taken' && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-4 rounded-2xl flex items-start gap-3">
              <span className="text-red-500 font-bold shrink-0">⚠️</span>
              <div className="text-left">
                <p className="text-sm font-bold text-red-800 dark:text-red-400">加入失敗：暱稱已被佔用</p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1 leading-normal">房間內已經有其他玩家使用此暱稱。請換一個名字再試一次！</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">您的暱稱</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 小明"
              className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-3 bg-zinc-100 dark:bg-zinc-700 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <Plus size={24} />
              </div>
              <span className="font-bold text-sm">建立房間</span>
            </button>

            <button
              onClick={handleJoin}
              disabled={!name.trim() || (!roomIdInput.trim() && !detectedRoomId)}
              className="flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-3 bg-zinc-100 dark:bg-zinc-700 rounded-xl group-hover:bg-green-500 group-hover:text-white transition-colors">
                <LogIn size={24} />
              </div>
              <span className="font-bold text-sm">加入房間</span>
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">房號 (若要加入)</label>
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
              placeholder="輸入 5 碼代碼"
              className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center tracking-widest text-xl font-black"
              maxLength={5}
            />
          </div>

          {detectedRoomId && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-3 rounded-xl flex items-center gap-3 animate-pulse">
              <Zap size={18} className="text-blue-500" />
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                已偵測到邀請連結: <span className="underline">{detectedRoomId}</span>
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="space-y-1">
            <Shield size={20} className="mx-auto text-blue-500" />
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">End-to-End</p>
          </div>
          <div className="space-y-1">
            <Zap size={20} className="mx-auto text-orange-500" />
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Low Latency</p>
          </div>
        </div>

        <div className="pt-8 text-center border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-center gap-6 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">
            <div className="flex flex-col gap-1">
              <span>Views</span>
              <span id="vercount_value_site_pv" className="text-zinc-900 dark:text-zinc-100 text-sm tracking-normal">--</span>
            </div>
            <div className="flex flex-col gap-1">
              <span>Visitors</span>
              <span id="vercount_value_site_uv" className="text-zinc-900 dark:text-zinc-100 text-sm tracking-normal">--</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
