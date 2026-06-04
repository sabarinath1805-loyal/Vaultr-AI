"use client";

import React from "react";
import { ANTHROPIC_MAX_MODEL } from "@/lib/models";

interface ThinkingIndicatorProps {
  visible: boolean;
  activeModel?: string | null;
}

export function ThinkingIndicator({ visible, activeModel }: ThinkingIndicatorProps) {
  const isDeepAnalysis = activeModel === ANTHROPIC_MAX_MODEL;
  const label = isDeepAnalysis ? "Lex Max — Deep Analysis in Progress" : "Lex is thinking";

  return (
    <div
      className={`lex-thinking-indicator mb-3 flex items-center gap-2 text-[var(--text-primary)] ${
        visible ? "lex-thinking-visible" : "lex-thinking-hidden"
      }`}
      data-testid="lex-thinking-indicator"
    >
      <span className="inline-flex items-center justify-center font-semibold" style={{ fontSize: '28px', lineHeight: 1, width: '28px', height: '28px', position: 'relative', top: '-1px' }}>✳</span>
      <span className="font-semibold" style={{ fontSize: '16px', lineHeight: '28px', marginLeft: '-2px' }}>{label}</span>
      <span className={`lex-thinking-dots${isDeepAnalysis ? " lex-deep-analysis-dots" : ""}`} aria-hidden="true" style={{ lineHeight: '28px' }}>
        <span>●</span>
        <span>●</span>
        <span>●</span>
      </span>
    </div>
  );
}
