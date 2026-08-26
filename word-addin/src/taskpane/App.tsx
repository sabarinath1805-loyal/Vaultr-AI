import React, { useState } from "react";
import { useAuth } from "./auth/useAuth";
import { LoginPage } from "./auth/LoginPage";
import { ApiKeyBanner } from "./components/ApiKeyBanner";
import { ChatPanel } from "./components/ChatPanel";
import { DocumentActions } from "./components/DocumentActions";
import { WorkflowPicker } from "./components/WorkflowPicker";
import { ProjectPicker } from "./components/ProjectPicker";
import { Button } from "@vaultr/shared/ui/button";
import { Spinner } from "@vaultr/shared/ui/spinner";
import { TabPillButton } from "@vaultr/shared/ui/tab-pill-button";
import { VaultrIcon } from "@vaultr/shared/chat/vaultr-icon";

type TabValue = "chat" | "actions" | "workflows" | "projects";

const TABS: { value: TabValue; label: string }[] = [
  { value: "chat", label: "Chat" },
  { value: "actions", label: "Actions" },
  { value: "workflows", label: "Workflows" },
  { value: "projects", label: "Projects" },
];

export default function App(): React.ReactElement {
  const { token, loading, logout } = useAuth();
  const [selectedTab, setSelectedTab] = useState<TabValue>("chat");

  // Show a minimal spinner while the token is being read from storage
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (!token) {
    return <LoginPage />;
  }

  const renderTab = (): React.ReactElement => {
    switch (selectedTab) {
      case "chat":
        return <ChatPanel />;
      case "actions":
        return <DocumentActions />;
      case "workflows":
        return <WorkflowPicker />;
      case "projects":
        return <ProjectPicker />;
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-3 py-3 @sm:px-4">
        <div className="flex items-center gap-2">
          <VaultrIcon size={22} />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            Vaultr
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => void logout()}
        >
          Sign out
        </Button>
      </header>

      {/* Setup nudge when no AI provider key is configured */}
      <ApiKeyBanner />

      {/* Tab bar — the web app's glass pill tabs, wrapped to fit the pane */}
      <nav
        role="tablist"
        aria-label="Vaultr sections"
        className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border/70 px-3 py-2"
      >
        {TABS.map((tab) => {
          const active = selectedTab === tab.value;
          return (
            <TabPillButton
              key={tab.value}
              role="tab"
              aria-selected={active}
              active={active}
              onClick={() => setSelectedTab(tab.value)}
            >
              {tab.label}
            </TabPillButton>
          );
        })}
      </nav>

      {/* Active tab content */}
      <div className="flex flex-1 flex-col overflow-hidden">{renderTab()}</div>
    </div>
  );
}
