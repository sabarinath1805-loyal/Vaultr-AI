"use client";

import React from "react";

interface ThinkingIndicatorProps {
  visible: boolean;
}

export function ThinkingIndicator({ visible }: ThinkingIndicatorProps) {
  return (
    <div
      className={`lex-thinking-indicator mb-3 flex items-center text-[16px] leading-none text-[var(--text-primary)] ${
        visible ? "lex-thinking-visible" : "lex-thinking-hidden"
      }`}
      data-testid="lex-thinking-indicator"
    >
      <span className="text-[16px] font-semibold leading-none">✳</span>
      <span aria-hidden="true" className="w-2" />
      <span className="text-[16px] font-semibold leading-none">Lex is thinking</span>
      <span aria-hidden="true" className="w-2" />
      <span className="lex-thinking-dots" aria-hidden="true">
        <span>●</span>
        <span>●</span>
        <span>●</span>
      </span>
    </div>
  );
}
