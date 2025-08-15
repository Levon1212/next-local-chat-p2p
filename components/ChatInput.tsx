"use client";

import React, { useRef, useState } from "react";
import FilePreview from "./FilePreview";
import styles from "./ChatInput.module.scss";

type SelectedFile = { file: File; url: string };

export default function ChatInput({
  onSend,
  uploadProgress,
  onCancelAttachment,
}: {
  onSend: (text: string, files: File[]) => Promise<void> | void;
  uploadProgress?: Record<string, number>; // key by attachmentId OR file.name if not yet id
  onCancelAttachment?: (key: string) => void; // key matches uploadProgress and file mapping
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = Array.from(e.target.files || []);
    const mapped: SelectedFile[] = fl.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setFiles((prev) => [...prev, ...mapped]);
  }

  function removeFile(idx: number) {
    const f = files[idx];
    URL.revokeObjectURL(f.url);
    setFiles(files.filter((_, i) => i !== idx));
  }

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const outFiles = files.map((f) => f.file);
    await onSend(text, outFiles);
    // Clear
    setText("");
    files.forEach((f) => URL.revokeObjectURL(f.url));
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form onSubmit={handleSend} className={styles.form}>
      <input
        className={styles.textInput}
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <input type="file" multiple ref={fileInputRef} onChange={handlePick} />
      <button className={styles.sendBtn} type="submit">Send</button>

      {!!files.length && (
        <div className={styles.previewRow}>
          {files.map((f, idx) => {
            const key = f.file.name + ":" + f.file.size + ":" + f.file.type;
            const prog = uploadProgress?.[key];
            return (
              <FilePreview
                key={key}
                u={{ url: f.url, name: f.file.name, type: f.file.type }}
                removable={prog === undefined}
                onRemove={() => removeFile(idx)}
                progress={prog}
              />
            );
          })}
        </div>
      )}
    </form>
  );
}
