'use client';

import { useEffect, useRef, useState } from 'react';
import { db, persistStorage, type Message, type Attachment } from '@/lib/db';
import { create } from 'zustand';
import { getSocket } from '@/lib/signal';
import Peer from 'simple-peer';
import { HARDCODED_PASSWORD } from './PasswordGate';

type Prefs = {
  meIsBlack: boolean;
  setMeIsBlack: (v: boolean) => void;
};

const usePrefs = create<Prefs>((set) => ({
  meIsBlack: (() => (typeof window !== 'undefined' ? (localStorage.getItem('meIsBlack') ?? '1') === '1' : true))(),
  setMeIsBlack: (v) => {
    if (typeof window !== 'undefined') localStorage.setItem('meIsBlack', v ? '1' : '0');
    set({ meIsBlack: v });
  },
}));

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type WireMessage = {
  id: string;
  text: string;
  sender: 'me' | 'other';
  ts: number;
  attachments?: { id: string; name: string; type: string; size: number }[];
};

type FileChunk = {
  kind: 'file-chunk';
  attachmentId: string;
  name: string;
  type: string;
  totalSize: number;
  seq: number;
  totalSeq: number;
  payload: ArrayBuffer;
};

type WireEnvelope = 
  | { kind: 'chat'; msg: WireMessage }
  | FileChunk;

function hashRoomKey(pw: string) {
  let h = 0;
  for (let i=0;i<pw.length;i++) { h = ((h<<5)-h) + pw.charCodeAt(i); h |= 0; }
  return 'room-' + (h >>> 0).toString(36);
}

export default function Chat() {
  const { meIsBlack, setMeIsBlack } = usePrefs();
  const [sender, setSender] = useState<'me'|'other'>('me');
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);

  const peersRef = useRef(new Map<string, Peer.Instance>());
  const incomingFileBuffers = useRef(new Map<string, { buffers: ArrayBuffer[]; meta: { id: string; name: string; type: string; size: number; } }>());

  const roomKey = hashRoomKey(HARDCODED_PASSWORD);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await persistStorage();
      const all = await db.messages.orderBy('ts').toArray();
      if (mounted) setMessages(all);
    })();
    const onChange = () => db.messages.orderBy('ts').toArray().then(setMessages);
    db.messages.hook('creating', onChange as any);
    db.messages.hook('updating', onChange as any);
    db.messages.hook('deleting', onChange as any);
    return () => {
      mounted = false;
      db.messages.hook('creating').unsubscribe(onChange as any);
      db.messages.hook('updating').unsubscribe(onChange as any);
      db.messages.hook('deleting').unsubscribe(onChange as any);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();

    function connectToPeer(peerId: string, initiator: boolean) {
      if (peersRef.current.has(peerId)) return;
      const peer = new Peer({ initiator, trickle: true });

      peer.on('signal', (data) => {
        socket.emit('signal', { to: peerId, data });
      });

      peer.on('connect', () => {
        setConnectedPeers((prev) => Array.from(new Set([...prev, peerId])));
      });

      peer.on('close', () => {
        setConnectedPeers((prev) => prev.filter((id) => id !== peerId));
        peersRef.current.delete(peerId);
      });

      peer.on('error', () => {
        setConnectedPeers((prev) => prev.filter((id) => id !== peerId));
        peersRef.current.delete(peerId);
      });

      peer.on('data', async (buf: Uint8Array) => {
        try {
          if (buf[0] === 0x00) {
            const view = buf.subarray(1);
            const dec = new TextDecoder();
            const headerLen = new DataView(view.buffer, view.byteOffset, 4).getUint32(0);
            const headerStr = dec.decode(view.subarray(4, 4 + headerLen));
            const header = JSON.parse(headerStr);
            const payload = view.subarray(4 + headerLen).buffer;
            const chunk: FileChunk = { ...header, payload };
            await handleIncomingChunk(chunk);
          } else {
            const json = new TextDecoder().decode(buf);
            const env = JSON.parse(json) as WireEnvelope;
            if (env.kind === 'chat') {
              await saveIncoming(env.msg);
            }
          }
        } catch (e) {
          console.error('data parse error', e);
        }
      });

      peersRef.current.set(peerId, peer);
      return peer;
    }

    const joinRoom = () => socket.emit('join', roomKey);
    if (socket.connected) joinRoom(); else socket.on('connect', joinRoom);

    socket.on('peers', (others: string[]) => {
      others.forEach((id) => connectToPeer(id, true));
    });

    socket.on('peer-joined', (id: string) => {
      connectToPeer(id, false);
    });

    socket.on('peer-left', (id: string) => {
      const p = peersRef.current.get(id);
      if (p) p.destroy();
      peersRef.current.delete(id);
      setConnectedPeers((prev) => prev.filter((x) => x !== id));
    });

    socket.on('signal', ({ from, data }) => {
      const p = peersRef.current.get(from) || connectToPeer(from, false);
      p?.signal(data);
    });

    return () => {
      socket.disconnect();
      for (const p of peersRef.current.values()) p.destroy();
      peersRef.current.clear();
      setConnectedPeers([]);
    };
  }, [roomKey]);

  async function saveIncoming(msg: WireMessage) {
    await db.messages.put({
      id: msg.id,
      sender: 'other',
      text: msg.text,
      ts: msg.ts,
      attachments: msg.attachments,
    });
  }

  async function handleIncomingChunk(chunk: FileChunk) {
    const key = chunk.attachmentId;
    if (!incomingFileBuffers.current.has(key)) {
      incomingFileBuffers.current.set(key, { buffers: [], meta: { id: chunk.attachmentId, name: chunk.name, type: chunk.type, size: chunk.totalSize } });
    }
    const rec = incomingFileBuffers.current.get(key)!;
    rec.buffers.push(chunk.payload);
    const total = rec.buffers.reduce((a,b)=>a+b.byteLength,0);
    if (total >= rec.meta.size) {
      const blob = new Blob(rec.buffers, { type: rec.meta.type || 'application/octet-stream' });
      await db.files.put({ id: key, blob });
      incomingFileBuffers.current.delete(key);
    }
  }

  async function addLocalMessage(partial: Partial<Message>, files: File[] = []) {
    const id = uid();
    const atts: Attachment[] = [];
    for (const f of files) {
      const fid = uid();
      await db.files.put({ id: fid, blob: f });
      atts.push({ id: fid, name: f.name, type: f.type, size: f.size });
    }
    const record: Message = {
      id, sender: partial.sender ?? 'me', text: partial.text ?? '', ts: Date.now(), attachments: atts.length ? atts : undefined
    };
    await db.messages.put(record);
    return record;
  }

  function broadcastEnvelope(env: WireEnvelope) {
    const buf = new TextEncoder().encode(JSON.stringify(env));
    for (const p of peersRef.current.values()) {
      const ch = (p as any)._channel;
      if (ch && ch.readyState === 'open') p.send(buf);
    }
  }

  async function sendFiles(files: File[], attachments: Attachment[]) {
    const CHUNK = 64 * 1024;
    for (const a of attachments) {
      const file = files.find(f => f.name === a.name && f.size === a.size && f.type === a.type);
      if (!file) continue;
      const totalSeq = Math.ceil(file.size / CHUNK) || 1;
      for (let seq=0; seq<totalSeq; seq++) {
        const start = seq * CHUNK;
        const end = Math.min(start + CHUNK, file.size);
        const slice = await file.slice(start, end).arrayBuffer();
        const header = {
          kind: 'file-chunk',
          attachmentId: a.id,
          name: a.name,
          type: a.type,
          totalSize: a.size,
          seq,
          totalSeq
        };
        const headerStr = JSON.stringify(header);
        const headerBytes = new TextEncoder().encode(headerStr);
        const headerLen = new Uint8Array(4);
        new DataView(headerLen.buffer).setUint32(0, headerBytes.length);
        const packet = new Uint8Array(1 + 4 + headerBytes.length + slice.byteLength);
        packet[0] = 0x00;
        packet.set(headerLen, 1);
        packet.set(headerBytes, 1 + 4);
        packet.set(new Uint8Array(slice), 1 + 4 + headerBytes.length);
        for (const p of peersRef.current.values()) {
          const ch = (p as any)._channel;
          if (ch && ch.readyState === 'open') p.send(packet);
        }
      }
    }
  }

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const files = Array.from(fileInputRef.current?.files || []);
    const localMsg = await addLocalMessage({ text }, files);
    setText('');
    if (fileInputRef.current) fileInputRef.current.value = '';

    const wire: WireMessage = {
      id: localMsg.id,
      text: localMsg.text,
      sender: 'me',
      ts: localMsg.ts,
      attachments: localMsg.attachments
    };
    broadcastEnvelope({ kind: 'chat', msg: wire });

    if (files.length && localMsg.attachments?.length) {
      await sendFiles(files, localMsg.attachments);
    }
  }

  async function clearAll() {
    if (!confirm('Delete all messages & files locally?')) return;
    await db.messages.clear();
    await db.files.clear();
  }

  async function exportChat() {
    const msgs = await db.messages.orderBy('ts').toArray();
    const fileRefs = await db.files.toArray();
    const data = { msgs, fileRefs: fileRefs.map(f => ({ id: f.id, size: f.blob.size, type: f.blob.type })) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="toolbar">
        <div className="badge">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={meIsBlack} onChange={(e) => setMeIsBlack(e.target.checked)} />
            <span>My bubbles: black / Other: white</span>
          </label>
        </div>
        <div className="badge">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Sender:
            <select className="input" value={sender} onChange={(e) => setSender(e.target.value as any)}>
              <option value="me">Me</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <span className="badge">Peers: {connectedPeers.length}</span>
        <button className="btn" onClick={exportChat}>Export</button>
        <button className="btn" onClick={clearAll}>Clear</button>
      </div>

      <hr />

      <div className="bubbles" style={{ margin: '12px 0', minHeight: 240 }}>
        {messages.map((m) => (
          <Bubble key={m.id} m={m} meIsBlack={meIsBlack} />
        ))}
      </div>

      <form onSubmit={handleSend} className="row">
        <input
          className="input flex-1"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input type="file" multiple ref={fileInputRef} />
        <button className="btn primary" type="submit">Send</button>
      </form>

      <p><small className="mono">P2P over WebRTC. Signaling via Socket.IO. Data stored only in your browser.</small></p>
    </div>
  );
}

function Bubble({ m, meIsBlack }: { m: Message; meIsBlack: boolean; }) {
  const [urls, setUrls] = useState<{ id: string; url: string; name: string; type: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: { id: string; url: string; name: string; type: string }[] = [];
      for (const a of m.attachments ?? []) {
        const rec = await db.files.get(a.id);
        if (rec) {
          const u = URL.createObjectURL(rec.blob);
          out.push({ id: a.id, url: u, name: a.name, type: a.type });
        }
      }
      if (!cancelled) setUrls(out);
      return () => { for (const u of out) URL.revokeObjectURL(u.url); };
    })();
    return () => { cancelled = true; };
  }, [m.id]);

  const isMe = m.sender === 'me';
  const meBg = meIsBlack ? '#000' : '#fff';
  const meFg = meIsBlack ? '#fff' : '#000';
  const otherBg = meIsBlack ? '#fff' : '#000';
  const otherFg = meIsBlack ? '#000' : '#fff';
  const bg = isMe ? meBg : otherBg;
  const fg = isMe ? meFg : otherFg;

  return (
    <div className={`bubble ${isMe ? 'me' : 'other'}`} style={{ background: bg, color: fg }}>
      <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
      {!!urls.length && (
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 8 }}>
          {urls.map(u => (
            <AttachmentPreview key={u.id} u={u} />
          ))}
        </div>
      )}
      <div><small className="mono">{new Date(m.ts).toLocaleString()}</small></div>
    </div>
  );
}

function AttachmentPreview({ u }: { u: { id: string; url: string; name: string; type: string } }) {
  const isImage = u.type.startsWith('image/');
  return (
    <div className="col" style={{ alignItems: 'center' }}>
      {isImage ? (
        <img className="thumb" src={u.url} alt={u.name} />
      ) : (
        <div className="thumb" style={{ display: 'grid', placeItems: 'center' }}>
          <span style={{ textAlign: 'center' }}>{u.type || 'file'}</span>
        </div>
      )}
      <a className="btn" href={u.url} download={u.name} style={{ textDecoration: 'none' }}>
        Download {u.name}
      </a>
    </div>
  );
}
