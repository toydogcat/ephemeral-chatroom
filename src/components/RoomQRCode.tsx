import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface RoomQRCodeProps {
  roomId: string;
}

export const RoomQRCode: React.FC<RoomQRCodeProps> = ({ roomId }) => {
  const [copied, setCopied] = useState(false);
  const joinUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-2xl shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <h3 className="text-lg font-bold mb-4 text-zinc-800 dark:text-zinc-200">邀請好友加入</h3>
      <div className="p-3 bg-white rounded-xl shadow-inner mb-4">
        <QRCodeSVG value={joinUrl} size={200} />
      </div>
      <div className="flex items-center gap-2 w-full max-w-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
        <span className="text-xs truncate flex-1 text-zinc-500">{joinUrl}</span>
        <button
          onClick={copyToClipboard}
          className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
        >
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
        </button>
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-500">房號: <span className="text-zinc-800 dark:text-zinc-200 font-bold">{roomId}</span></p>
    </div>
  );
};
