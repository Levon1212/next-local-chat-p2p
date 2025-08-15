"use client";

import React, { useEffect, useMemo, useRef } from "react";
import type { Message } from "@/lib/db";
import MessageItem from "./MessageItem";
import styles from "./ChatFeed.module.scss";

export default function ChatFeed({
  messages,
  meIsBlack,
}: {
  messages: Message[];
  meIsBlack: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => {
    return [...messages].sort((a, b) => a.ts - b.ts);
  }, [messages]);

  useEffect(() => {
    // Auto scroll on new messages
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [sorted.length]);

  return (
    <div className={styles.feed}>
      {sorted.map((m) => (
        <MessageItem key={m.id} m={m} meIsBlack={meIsBlack} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
