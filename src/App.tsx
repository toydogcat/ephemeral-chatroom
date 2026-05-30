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
    muteGuest,
    joinError,
    presentation,
    broadcastPresentation,
    clearPresentation,
  } = useWebRTC();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {!roomState ? (
        <LandingPage onCreateRoom={createRoom} onJoinRoom={joinRoom} joinError={joinError} />
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
          onMuteGuest={muteGuest}
          presentation={presentation}
          onBroadcastPresentation={broadcastPresentation}
          onClearPresentation={clearPresentation}
        />
      )}
    </div>
  );
}

export default App;
