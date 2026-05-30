import { useWebRTC } from './hooks/useWebRTC';
import { LandingPage } from './components/LandingPage';
import { ChatRoom } from './components/ChatRoom';

function App() {
  const {
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
  } = useWebRTC();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {!roomState ? (
        <LandingPage onCreateRoom={createRoom} onJoinRoom={joinRoom} />
      ) : (
        <ChatRoom
          myId={myId}
          roomId={roomState.roomId}
          players={roomState.players}
          messages={messages}
          isConnected={isConnected}
          onSendMessage={sendMessage}
          onSendFile={sendFile}
          isVoiceActive={isVoiceActive}
          remoteStream={remoteStream}
          onToggleVoice={toggleVoice}
        />
      )}
    </div>
  );
}

export default App;
