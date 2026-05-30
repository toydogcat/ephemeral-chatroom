export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isOffline?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type?: 'text' | 'file';
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileData?: string; // Base64 data URL
}

export interface RoomState {
  roomId: string;
  players: Player[];
  messages: ChatMessage[];
}

export interface SignalingData {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export type SignalingMessage =
  | { type: 'join'; id: string; name: string }
  | { type: 'join_reject'; reason: 'nickname_taken' }
  | { type: 'lobby_sync'; players: Player[] }
  | { type: 'signal'; from: string; to: string; data: SignalingData }
  | { type: 'start' };

export interface DrawingData {
  type?: 'drawing';
  action: 'draw' | 'clear' | 'ppt_slide' | 'ppt_start';
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  color?: string;
  width?: number;
  index?: number;
  deck?: any;
}
