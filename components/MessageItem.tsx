"use client";

import React, { useEffect, useState } from "react";
import { db, type Message } from "@/lib/db";
import FilePreview from "./FilePreview";
import styles from "./MessageItem.module.scss";

export default function MessageItem({ m, meIsBlack }: { m: Message; meIsBlack: boolean }) {
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
      return () => {
        for (const u of out) URL.revokeObjectURL(u.url);
      };
    })();
    return () => {
      cancelled = true;
    };
  }, [m.id]);

  const isMe = m.sender === "me";
  const meBg = meIsBlack ? "#000" : "#fff";
  const meFg = meIsBlack ? "#fff" : "#000";
  const otherBg = meIsBlack ? "#fff" : "#000";
  const otherFg = meIsBlack ? "#000" : "#fff";
  const bg = isMe ? meBg : otherBg;
  const fg = isMe ? meFg : otherFg;

  return (
    <div className={`${styles.bubble} ${isMe ? styles.me : styles.other}`} style={{ background: bg, color: fg }}>
      <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
      {!!urls.length && (
        <div className={styles.attachmentsRow}>
          {urls.map((u) => (
            <FilePreview key={u.id} u={u} />
          ))}
        </div>
      )}
      <div className={styles.timestamp}><small>{new Date(m.ts).toLocaleString()}</small></div>
    </div>
  );
}
