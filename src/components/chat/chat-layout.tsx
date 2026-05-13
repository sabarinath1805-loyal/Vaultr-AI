"use client";

import Chat, { ChatProps } from "./chat";

interface ChatLayoutProps {
  defaultLayout: number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize: number;
}

type MergedProps = ChatLayoutProps & ChatProps;

export function ChatLayout({
  initialMessages,
  id,
}: MergedProps) {
  return (
    <div className="flex h-screen w-full justify-center">
      <Chat id={id} initialMessages={initialMessages} />
    </div>
  );
}
