import "./../styles/globals.css";
import PasswordGate from "@/components/PasswordGate";
import Chat from "@/components/Chat";

export default function Page() {
  return (
    <main className="container">
      <h1>P2P Local Chat (No Server Storage)</h1>
      <p className="badge">WebRTC P2P • Socket.IO signaling • IndexedDB + localStorage</p>
      <PasswordGate>
        <Chat />
      </PasswordGate>
    </main>
  );
}
