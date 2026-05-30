import { useState, useRef, useCallback, useEffect } from 'react';
import mqtt from 'mqtt';
import type { Player, ChatMessage, RoomState, SignalingMessage, SignalingData } from '../types';

const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
};

export function useWebRTC() {
  const [myId] = useState(() => {
    let id = localStorage.getItem('chat_player_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 9);
      localStorage.setItem('chat_player_id', id);
    }
    return id;
  });

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // 課堂大屏幕狀態
  const [presentation, setPresentation] = useState<{
    contentType: string;
    contentData: string;
    name?: string;
  } | null>(null);

  const mqttClient = useRef<mqtt.MqttClient | null>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const dataChannels = useRef<{ [key: string]: RTCDataChannel }>({});
  const roomIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // 解決 WebRTC 跨網絡 (如 Wi-Fi vs 5G 行動網絡) 連線 Timing 問題的暫存隊列
  const pendingCandidates = useRef<{ [key: string]: RTCIceCandidateInit[] }>({});
  const playersRef = useRef<Player[]>([]);

  useEffect(() => {
    if (roomState) {
      playersRef.current = roomState.players;
    } else {
      playersRef.current = [];
    }
  }, [roomState]);

  const broadcastMessage = useCallback((msg: ChatMessage) => {
    const data = JSON.stringify({ type: 'chat', ...msg });
    Object.values(dataChannels.current).forEach((dc) => {
      if (dc.readyState === 'open') {
        dc.send(data);
      }
    });
    setMessages((prev) => [...prev, msg]);
  }, []);

  const disableVoice = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setIsVoiceActive(false);
    setRemoteStream(null);

    Object.entries(peerConnections.current).forEach(([peerId, pc]) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          pc.removeTrack(sender);
        }
      });

      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        const roomId = roomIdRef.current;
        mqttClient.current?.publish(`luna/chat/${roomId}/signal/${peerId}`, JSON.stringify({
          type: 'signal',
          from: myId,
          to: peerId,
          data: { sdp: offer },
        }));
      });
    });
  }, [myId]);

  const setupDataChannel = useCallback((dc: RTCDataChannel, peerId: string) => {
    dataChannels.current[peerId] = dc;
    dc.onopen = () => {
      console.log(`Data channel with ${peerId} opened`);
      setIsConnected(true);
    };
    dc.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // 1. 處理禁言指令
      if (data.type === 'control') {
        if (data.action === 'mute' && data.targetId === myId) {
          disableVoice();
          alert('您已被房主禁言！麥克風已被強制關閉。');
        }
        return;
      }

      // 2. 處理大白板同步指令
      if (data.type === 'presentation') {
        setPresentation({
          contentType: data.contentType,
          contentData: data.contentData,
          name: data.name,
        });
        return;
      }

      if (data.type === 'clear_presentation') {
        setPresentation(null);
        return;
      }

      // 3. 聊天訊息接收
      if (data.senderId) {
        setMessages((prev) => [...prev, data]);
      }
    };
    dc.onclose = () => {
      console.log(`Data channel with ${peerId} closed`);
      delete dataChannels.current[peerId];
    };
  }, [myId, disableVoice]);

  const handleGuestJoin = useCallback((roomId: string, guestId: string, guestName: string) => {
    const currentPlayers = playersRef.current;

    // 審查暱稱唯一性
    const isNameTaken = currentPlayers.some(
      (p) => p.id !== guestId && p.name.toLowerCase() === guestName.toLowerCase()
    );
    if (isNameTaken) {
      console.log(`Join rejected: Nickname "${guestName}" is taken.`);
      mqttClient.current?.publish(
        `luna/chat/${roomId}/join_reject/${guestId}`,
        JSON.stringify({
          type: 'join_reject',
          reason: 'nickname_taken',
        })
      );
      return;
    }

    const existingPlayer = currentPlayers.find((p) => p.id === guestId);

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[guestId] = pc;

    pc.ontrack = (event) => {
      console.log('Host received remote track', event.streams[0]);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    const dc = pc.createDataChannel('chat');
    setupDataChannel(dc, guestId);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        mqttClient.current?.publish(`luna/chat/${roomId}/signal/${guestId}`, JSON.stringify({
          type: 'signal',
          from: myId,
          to: guestId,
          data: { candidate: event.candidate },
        }));
      }
    };

    pc.createOffer().then((offer) => {
      pc.setLocalDescription(offer);
      mqttClient.current?.publish(`luna/chat/${roomId}/signal/${guestId}`, JSON.stringify({
        type: 'signal',
        from: myId,
        to: guestId,
        data: { sdp: offer },
      }));
    });

    if (presentation) {
      setTimeout(() => {
        if (dc.readyState === 'open') {
          dc.send(JSON.stringify({
            type: 'presentation',
            contentType: presentation.contentType,
            contentData: presentation.contentData,
            name: presentation.name,
          }));
        }
      }, 2000);
    }

    setRoomState((prev) => {
      if (!prev) return null;
      
      let newPlayers;
      if (existingPlayer) {
        newPlayers = prev.players.map((p) => (p.id === guestId ? { ...p, name: guestName } : p));
      } else {
        newPlayers = [...prev.players, { id: guestId, name: guestName, isHost: false }];
      }

      mqttClient.current?.publish(`luna/chat/${roomId}/lobby_sync`, JSON.stringify({
        type: 'lobby_sync',
        players: newPlayers,
      }));
      return { ...prev, players: newPlayers };
    });
  }, [myId, setupDataChannel, presentation]);

  const handleSignal = useCallback(async (fromId: string, data: SignalingData) => {
    let pc = peerConnections.current[fromId];
    if (!pc) {
      pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current[fromId] = pc;

      pc.ontrack = (event) => {
        console.log('Guest received remote track', event.streams[0]);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.ondatachannel = (event) => {
        setupDataChannel(event.channel, fromId);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const roomId = roomIdRef.current;
          if (roomId) {
            mqttClient.current?.publish(`luna/chat/${roomId}/signal/${fromId}`, JSON.stringify({
              type: 'signal',
              from: myId,
              to: fromId,
              data: { candidate: event.candidate },
            }));
          }
        }
      };
    }

    if (data.sdp) {
      // 1. 先設定遠端的 Session Description
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      
      // 2. 釋放所有在此之前因為 remoteDescription 尚未就緒而被暫存的 ICE Candidates
      const candidates = pendingCandidates.current[fromId] || [];
      for (const cand of candidates) {
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch((err) => {
          console.warn('Deferred ICE Candidate addition failed:', err);
        });
      }
      pendingCandidates.current[fromId] = [];

      // 3. 若為 offer，則回傳 answer
      if (data.sdp.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const roomId = roomIdRef.current;
        if (roomId) {
          mqttClient.current?.publish(`luna/chat/${roomId}/signal/${fromId}`, JSON.stringify({
            type: 'signal',
            from: myId,
            to: fromId,
            data: { sdp: answer },
          }));
        }
      }
    } else if (data.candidate) {
      // 若遠端 SDP 尚未設定，先將 Candidate 快取進暫存隊列，解決跨網 Timing Bug
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch((err) => {
          console.warn('ICE Candidate addition failed:', err);
        });
      } else {
        if (!pendingCandidates.current[fromId]) {
          pendingCandidates.current[fromId] = [];
        }
        pendingCandidates.current[fromId].push(data.candidate);
        console.log(`ICE candidate from ${fromId} deferred due to missing remoteDescription.`);
      }
    }
  }, [myId, setupDataChannel]);

  const createRoom = useCallback((name: string) => {
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    roomIdRef.current = roomId;
    setJoinError(null);
    const host: Player = { id: myId, name, isHost: true };
    
    setRoomState({
      roomId,
      players: [host],
      messages: [],
    });

    const client = mqtt.connect(MQTT_BROKER);
    mqttClient.current = client;

    client.on('connect', () => {
      client.subscribe(`luna/chat/${roomId}/join`);
      client.subscribe(`luna/chat/${roomId}/signal/${myId}`);
      console.log('Host connected to MQTT');
    });

    client.on('message', (topic, payload) => {
      const msg: SignalingMessage = JSON.parse(payload.toString());
      
      if (topic === `luna/chat/${roomId}/join` && msg.type === 'join') {
        handleGuestJoin(roomId, msg.id, msg.name);
      } else if (topic === `luna/chat/${roomId}/signal/${myId}` && msg.type === 'signal') {
        handleSignal(msg.from, msg.data);
      }
    });
  }, [myId, handleGuestJoin, handleSignal]);

  const joinRoom = useCallback((roomId: string, name: string) => {
    roomIdRef.current = roomId;
    setJoinError(null);
    const client = mqtt.connect(MQTT_BROKER);
    mqttClient.current = client;

    client.on('connect', () => {
      client.subscribe(`luna/chat/${roomId}/lobby_sync`);
      client.subscribe(`luna/chat/${roomId}/signal/${myId}`);
      client.subscribe(`luna/chat/${roomId}/join_reject/${myId}`);
      
      client.publish(`luna/chat/${roomId}/join`, JSON.stringify({
        type: 'join',
        id: myId,
        name,
      }));
    });

    client.on('message', (topic, payload) => {
      const msg: SignalingMessage = JSON.parse(payload.toString());

      if (topic === `luna/chat/${roomId}/join_reject/${myId}` && msg.type === 'join_reject') {
        console.log('Join rejected by host:', msg.reason);
        setJoinError(msg.reason);
        client.end();
        mqttClient.current = null;
        setRoomState(null);
      } else if (topic === `luna/chat/${roomId}/lobby_sync` && msg.type === 'lobby_sync') {
        setRoomState({ roomId, players: msg.players, messages: [] });
      } else if (topic === `luna/chat/${roomId}/signal/${myId}` && msg.type === 'signal') {
        handleSignal(msg.from, msg.data);
      }
    });
  }, [myId, handleSignal]);

  const sendMessage = useCallback((text: string) => {
    const msg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId: myId,
      senderName: roomState?.players.find(p => p.id === myId)?.name || 'Unknown',
      text,
      timestamp: Date.now(),
      type: 'text',
    };
    broadcastMessage(msg);
  }, [myId, roomState, broadcastMessage]);

  const sendFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      const msg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        senderId: myId,
        senderName: roomState?.players.find(p => p.id === myId)?.name || 'Unknown',
        text: `分享了檔案: ${file.name}`,
        timestamp: Date.now(),
        type: 'file',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileData: base64Data,
      };
      broadcastMessage(msg);
    };
    reader.readAsDataURL(file);
  }, [myId, roomState, broadcastMessage]);

  const toggleVoice = useCallback(async () => {
    if (isVoiceActive) {
      disableVoice();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setIsVoiceActive(true);

        Object.entries(peerConnections.current).forEach(([peerId, pc]) => {
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
          });

          pc.createOffer().then((offer) => {
            pc.setLocalDescription(offer);
            const roomId = roomIdRef.current;
            mqttClient.current?.publish(`luna/chat/${roomId}/signal/${peerId}`, JSON.stringify({
              type: 'signal',
              from: myId,
              to: peerId,
              data: { sdp: offer },
            }));
          });
        });
      } catch (err) {
        console.error('Failed to get user media for voice call:', err);
        alert('無法取得麥克風權限！請確認已授權。');
      }
    }
  }, [isVoiceActive, disableVoice, myId]);

  const muteGuest = useCallback((targetId: string) => {
    const myPlayer = roomState?.players.find(p => p.id === myId);
    if (!myPlayer?.isHost) return;

    const data = JSON.stringify({
      type: 'control',
      action: 'mute',
      targetId,
    });

    Object.values(dataChannels.current).forEach((dc) => {
      if (dc.readyState === 'open') {
        dc.send(data);
      }
    });
  }, [myId, roomState]);

  const broadcastPresentation = useCallback((contentType: string, contentData: string, name?: string) => {
    const myPlayer = roomState?.players.find((p) => p.id === myId);
    if (!myPlayer?.isHost) return;

    const data = JSON.stringify({
      type: 'presentation',
      contentType,
      contentData,
      name,
    });

    Object.values(dataChannels.current).forEach((dc) => {
      if (dc.readyState === 'open') {
        dc.send(data);
      }
    });

    setPresentation({ contentType, contentData, name });
  }, [myId, roomState]);

  const clearPresentation = useCallback(() => {
    const myPlayer = roomState?.players.find((p) => p.id === myId);
    if (!myPlayer?.isHost) return;

    const data = JSON.stringify({
      type: 'clear_presentation',
    });

    Object.values(dataChannels.current).forEach((dc) => {
      if (dc.readyState === 'open') {
        dc.send(data);
      }
    });

    setPresentation(null);
  }, [myId, roomState]);

  return {
    myId,
    roomState,
    messages,
    isConnected,
    createRoom,
    joinRoom,
    sendMessage,
    sendFile,
    isVoiceActive,
    remoteStream,
    toggleVoice,
    muteGuest,
    joinError,
    presentation,
    broadcastPresentation,
    clearPresentation,
  };
}
