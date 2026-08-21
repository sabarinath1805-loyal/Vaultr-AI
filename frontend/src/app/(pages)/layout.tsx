"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { ChatHistoryProvider } from "@/app/contexts/ChatHistoryContext";
import { SidebarContext } from "@/app/contexts/SidebarContext";
import { PageChromeContext } from "@/app/contexts/PageChromeContext";
import { AppSidebar } from "@/app/components/shared/AppSidebar";
import { FullScreenLoader } from "@/app/components/shared/FullScreenLoader";

export default function MikeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAuthenticated, authLoading } = useAuth();
    const router = useRouter();
    const [mobileActionsContainer, setMobileActionsContainer] =
        useState<HTMLDivElement | null>(null);

    const [isSidebarOpenDesktop, setIsSidebarOpenDesktop] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [sidebarPreferenceReady, setSidebarPreferenceReady] = useState(false);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            const saved = window.localStorage.getItem("sidebarOpen");
            const desktopOpen = saved !== null ? saved === "true" : true;

            setIsSidebarOpenDesktop(desktopOpen);
            setIsSidebarOpen(window.innerWidth < 768 ? false : desktopOpen);
            setSidebarPreferenceReady(true);
        });

        return () => window.cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (sidebarPreferenceReady && window.innerWidth >= 768) {
            window.localStorage.setItem(
                "sidebarOpen",
                isSidebarOpenDesktop.toString(),
            );
        }
    }, [isSidebarOpenDesktop, sidebarPreferenceReady]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleResize = () => {
            const isSmall = window.innerWidth < 768;
            if (isSmall && isSidebarOpen) setIsSidebarOpen(false);
            else if (!isSmall && !isSidebarOpen)
                setIsSidebarOpen(isSidebarOpenDesktop);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [isSidebarOpen, isSidebarOpenDesktop]);

    const handleSidebarToggle = () => {
        if (window.innerWidth >= 768) {
            setIsSidebarOpenDesktop(!isSidebarOpenDesktop);
            setIsSidebarOpen(!isSidebarOpenDesktop);
        } else {
            setIsSidebarOpen(!isSidebarOpen);
        }
    };

    const handleMobileActionsContainerRef = useCallback(
        (node: HTMLDivElement | null) => {
            setMobileActionsContainer(node);
        },
        [],
    );

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push("/login");
        }
    }, [authLoading, isAuthenticated, router]);

    if (authLoading) {
        return <FullScreenLoader />;
    }

    if (!isAuthenticated) return null;

    return (
        <ChatHistoryProvider>
            <PageChromeContext.Provider value={{ mobileActionsContainer }}>
                <SidebarContext.Provider
                    value={{
                        setSidebarOpen: (open) => {
                            const isSmall =
                                typeof window !== "undefined" &&
                                window.innerWidth < 768;
                            if (isSmall) {
                                if (!open) setIsSidebarOpen(false);
                                return;
                            }
                            setIsSidebarOpen(open);
                            setIsSidebarOpenDesktop(open);
                        },
                    }}
                >
                    <div className="vaultr-app-shell h-dvh flex flex-col bg-app-background">
                        <div className="flex-1 flex min-w-0 overflow-hidden">
                            <AppSidebar
                                isOpen={isSidebarOpen}
                                onToggle={handleSidebarToggle}
                            />
                            <div className="flex-1 flex flex-col h-dvh md:overflow-hidden relative w-full">
                                {/* Mobile header */}
                                <div className="relative z-20 flex md:hidden items-center gap-3 overflow-visible px-4 pt-3 pb-2 shrink-0">
                                    <button
                                        onClick={handleSidebarToggle}
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-app-surface text-gray-700 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/70 backdrop-blur-md transition-[background-color,color,box-shadow,transform] duration-150 hover:bg-app-floating active:scale-95"
                                        title="Open sidebar"
                                        aria-label="Open sidebar"
                                    >
                                        <PanelLeft className="h-4 w-4" />
                                    </button>
                                    <div
                                        ref={handleMobileActionsContainerRef}
                                        className="ml-auto flex min-w-0 flex-1 items-center justify-end"
                                    />
                                </div>
                                <main className="flex h-full w-full flex-1 flex-col overflow-y-auto md:overflow-hidden">
                                    {children}
                                </main>
                            </div>
                        </div>
                    </div>
                </SidebarContext.Provider>
            </PageChromeContext.Provider>
        </ChatHistoryProvider>
    );
}


