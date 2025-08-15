"use client";

import React from "react";
import styles from "./FilePreview.module.scss";

export default function FilePreview({
  u,
  removable,
  onRemove,
  progress,
}: {
  u: { id?: string; url: string; name: string; type: string };
  removable?: boolean;
  onRemove?: () => void;
  progress?: number; // 0-100
}) {
  const isImage = u.type?.startsWith("image/");
  return (
    <div className={styles.wrapper}>
      <div className={styles.thumbBox}>
        <a href={u.url} download={u.name} title={`Download ${u.name}`}>
          {isImage ? (
            <img className={styles.thumb} src={u.url} alt={u.name} />)
            : (
            <div className={`${styles.thumb} ${styles.generic}`}>{u.type || "file"}</div>
          )}
        </a>
        {typeof progress === "number" && (
          <div className={styles.progressBar}>
            <div className={styles.progress} style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className={styles.metaRow}>
        <span className={styles.name} title={u.name}>{u.name}</span>
        <a href={u.url} download={u.name} title={`Download ${u.name}`}>Download</a>
        {removable && (
          <button type="button" className={styles.removeBtn} onClick={onRemove}>✕</button>
        )}
      </div>
    </div>
  );
}
