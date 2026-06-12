"use client";

import React from "react";
import { ANTHROPIC_MAX_MODEL } from "@/lib/models";

interface ThinkingIndicatorProps {
  visible: boolean;
  activeModel?: string | null;
}

export function ThinkingIndicator({ visible, activeModel }: ThinkingIndicatorProps) {
  const isMax = activeModel === ANTHROPIC_MAX_MODEL;
  const label = isMax ? "Lex Max — Deep Analysis in Progress" : "Lex is thinking";

  return (
    <div
      className={`lex-thinking-indicator mb-3 flex items-center gap-1 text-[var(--text-primary)] ${
        visible ? "lex-thinking-visible" : "lex-thinking-hidden"
      }`}
      data-testid="lex-thinking-indicator"
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          fontSize: isMax ? '28px' : '22px',
          lineHeight: 1,
          width: isMax ? '28px' : '22px',
          height: isMax ? '28px' : '22px',
          position: 'relative',
          top: '-1px',
          fontWeight: isMax ? 600 : 400,
          color: isMax ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
      >✳</span>
      <span
        style={{
          fontSize: '16px',
          lineHeight: isMax ? '28px' : '22px',
          marginLeft: '-2px',
          fontWeight: isMax ? 500 : 400,
          color: isMax ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
      >{label}</span>
      <span className={`lex-thinking-dots${isMax ? " lex-deep-analysis-dots" : ""}`} aria-hidden="true" style={{ lineHeight: isMax ? '28px' : '22px' }}>
        <span>●</span>
        <span>●</span>
        <span>●</span>
      </span>
    </div>
  );
}
