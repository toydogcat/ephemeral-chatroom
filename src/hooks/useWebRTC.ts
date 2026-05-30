import { useState, useRef, useCallback } from 'react';
import mqtt from 'mqtt';
import type { Player, ChatMessage, RoomState, SignalingMessage, SignalingData } from '../types';

const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
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

  const mqttClient = useRef<mqtt.MqttClient | null>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const dataChannels = useRef<{ [key: string]: RTCDataChannel }>({});
  const roomIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const broadcastMessage = useCallback((msg: ChatMessage) => {
    const data = JSON.stringify({ type: 'chat', ...msg });
    Object.values(dataChannels.current).forEach((dc) => {
      if (dc.readyState === 'open') {
        dc.send(data);
      }
    });
    setMessages((prev) => [...prev, msg]);
  }, []);

  const setupDataChannel = useCallback((dc: RTCDataChannel, peerId: string) => {
    dataChannels.current[peerId] = dc;
    dc.onopen = () => {
      console.log(`Data channel with ${peerId} opened`);
      setIsConnected(true);
    };
    dc.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'chat') {
        setMessages((prev) => [...prev, msg]);
      }
    };
    dc.onclose = () => {
      console.log(`Data channel with ${peerId} closed`);
      delete dataChannels.current[peerId];
    };
  }, []);

  const handleGuestJoin = useCallback((roomId: string, guestId: string, guestName: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[guestId] = pc;

    // 監聽對方的音軌
    pc.ontrack = (event) => {
      console.log('Host received remote track', event.streams[0]);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // 如果目前自己已經開啟語音，則把自己的音軌加入
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

    setRoomState((prev) => {
      if (!prev) return null;
      const newPlayers = [...prev.players, { id: guestId, name: guestName, isHost: false }];
      mqttClient.current?.publish(`luna/chat/${roomId}/lobby_sync`, JSON.stringify({
        type: 'lobby_sync',
        players: newPlayers,
      }));
      return { ...prev, players: newPlayers };
    });
  }, [myId, setupDataChannel]);

  const handleSignal = useCallback(async (fromId: string, data: SignalingData) => {
    let pc = peerConnections.current[fromId];
    if (!pc) {
      pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current[fromId] = pc;

      // 監聽對方的音軌
      pc.ontrack = (event) => {
        console.log('Guest received remote track', event.streams[0]);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // 如果目前自己已經開啟語音，則把自己的音軌加入
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
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
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
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }, [myId, setupDataChannel]);

  const createRoom = useCallback((name: string) => {
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    roomIdRef.current = roomId;
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
    const client = mqtt.connect(MQTT_BROKER);
    mqttClient.current = client;

    client.on('connect', () => {
      client.subscribe(`luna/chat/${roomId}/lobby_sync`);
      client.subscribe(`luna/chat/${roomId}/signal/${myId}`);
      
      client.publish(`luna/chat/${roomId}/join`, JSON.stringify({
        type: 'join',
        id: myId,
        name,
      }));
    });

    client.on('message', (topic, payload) => {
      const msg: SignalingMessage = JSON.parse(payload.toString());

      if (topic === `luna/chat/${roomId}/lobby_sync` && msg.type === 'lobby_sync') {
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
      // 關閉語音
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      setIsVoiceActive(false);

      // 自所有 RTCPeerConnection 中移除音軌，並重新協商
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
      setRemoteStream(null);
    } else {
      try {
        // 開啟語音
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setIsVoiceActive(true);

        // 將音軌加進所有 RTCPeerConnection 中，並重新協商
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
  }, [isVoiceActive, myId]);

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
  };
}
