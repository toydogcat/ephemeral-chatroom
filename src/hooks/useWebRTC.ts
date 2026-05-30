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

  const mqttClient = useRef<mqtt.MqttClient | null>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const dataChannels = useRef<{ [key: string]: RTCDataChannel }>({});
  const roomIdRef = useRef<string | null>(null);

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
    };
    broadcastMessage(msg);
  }, [myId, roomState, broadcastMessage]);

  return {
    myId,
    roomState,
    messages,
    isConnected,
    createRoom,
    joinRoom,
    sendMessage,
  };
}
