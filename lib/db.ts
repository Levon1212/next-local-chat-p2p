'use client';

import Dexie, { Table } from 'dexie';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  sender: 'me' | 'other';
  text: string;
  ts: number;
  attachments?: Attachment[];
}

class ChatDB extends Dexie {
  messages!: Table<Message, string>;
  files!: Table<{ id: string; blob: Blob }, string>;

  constructor() {
    super('local-chat-db-p2p');
    this.version(1).stores({
      messages: 'id, ts',
      files: 'id'
    });
  }
}

export const db = new ChatDB();

export async function persistStorage() {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    try { await navigator.storage.persist(); } catch {}
  }
}
