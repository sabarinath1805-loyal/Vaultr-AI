"use client";

import React from "react";

interface ThinkingIndicatorProps {
  visible: boolean;
}

export function ThinkingIndicator({ visible }: ThinkingIndicatorProps) {
  return (
    <div
      className={`lex-thinking-indicator mb-3 flex items-center gap-2 text-[var(--text-primary)] ${
        visible ? "lex-thinking-visible" : "lex-thinking-hidden"
      }`}
      data-testid="lex-thinking-indicator"
    >
      <span className="inline-flex items-center justify-center font-semibold" style={{ fontSize: '28px', lineHeight: 1, width: '28px', height: '28px' }}>✳</span>
      <span className="font-semibold" style={{ fontSize: '16px', lineHeight: '28px' }}>Lex is thinking</span>
      <span className="lex-thinking-dots" aria-hidden="true" style={{ lineHeight: '28px' }}>
        <span>●</span>
        <span>●</span>
        <span>●</span>
      </span>
    </div>
  );
}
