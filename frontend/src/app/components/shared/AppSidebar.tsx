"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useUserProfile } from "@/app/contexts/UserProfileContext";
import { useChatHistoryContext } from "@/app/contexts/ChatHistoryContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarChatItem } from "@/app/components/shared/SidebarChatItem";
import { listProjects } from "@/app/lib/mikeApi";
import type { Chat, Project } from "@/app/components/shared/types";
import { cn } from "@/app/lib/utils";
import {
    APP_SURFACE_ACTIVE_CLASS,
    APP_SURFACE_HOVER_CLASS,
} from "@/app/components/ui/liquid-surface";
import { MovingIcon, type MovingIconName } from "@/app/components/ui/moving-icon";

const NAV_ITEMS = [
    { href: "/assistant", label: "Chats", icon: "message-square" },
    { href: "/projects", label: "Projects", icon: "folder" },
    { href: "/library", label: "Library", icon: "library" },
    { href: "/tabular-reviews", label: "Tabular Review", icon: "table" },
    { href: "/workflows", label: "Workflows", icon: "workflow" },
] satisfies { href: string; label: string; icon: MovingIconName }[];

type HistoryGroupKey = "today" | "yesterday" | "last-seven-days" | "older";

const HISTORY_GROUPS: { key: HistoryGroupKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "last-seven-days", label: "Last 7 Days" },
    { key: "older", label: "Older" },
];

function startOfDay(date: Date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function historyGroupFor(chat: Chat, now: Date): HistoryGroupKey {
    const createdAt = new Date(chat.created_at);
    if (Number.isNaN(createdAt.getTime())) return "older";

    const dayDistance = Math.floor(
        (startOfDay(now).getTime() - startOfDay(createdAt).getTime()) /
            (24 * 60 * 60 * 1000),
    );
    if (dayDistance <= 0) return "today";
    if (dayDistance === 1) return "yesterday";
    if (dayDistance <= 7) return "last-seven-days";
    return "older";
}

interface AppSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
}

export function AppSidebar({ isOpen, onToggle }: AppSidebarProps) {
    const { user } = useAuth();
    const { profile } = useUserProfile();
    const { chats, hasMoreChats, loadMoreChats, setCurrentChatId } =
        useChatHistoryContext();
    const router = useRouter();
    const pathname = usePathname();
    const routeChatId = useMemo(() => {
        if (pathname.startsWith("/assistant/chat/")) {
            return pathname.split("/").pop() ?? null;
        }

        const projectChatMatch = pathname.match(
            /^\/projects\/[^/]+\/assistant\/chat\/([^/]+)/,
        );
        return projectChatMatch?.[1] ?? null;
    }, [pathname]);
    const [shouldAnimate, setShouldAnimate] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [projectsCollapsed, setProjectsCollapsed] = useState(false);
    const [historyCollapsed, setHistoryCollapsed] = useState(false);
    const [historyQuery, setHistoryQuery] = useState("");
    const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<
        Set<HistoryGroupKey>
    >(() => new Set());
    const [projectNames, setProjectNames] = useState<Record<string, string>>(
        {},
    );
    const [recentProjects, setRecentProjects] = useState<Project[] | null>(
        null,
    );
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const searchTriggerRef = useRef<HTMLButtonElement>(null);
    const searchDialogRef = useRef<HTMLDivElement>(null);

    const openSearch = useCallback(() => {
        setHistoryQuery("");
        setIsSearchOpen(true);
    }, []);

    const closeSearch = useCallback(() => {
        setIsSearchOpen(false);
        requestAnimationFrame(() => searchTriggerRef.current?.focus());
    }, []);

    const groupedHistory = useMemo(() => {
        const query = historyQuery.trim().toLowerCase();
        const now = new Date();
        const filteredChats = (chats ?? []).filter((chat) => {
            if (!query) return true;
            const projectName = chat.project_id
                ? projectNames[chat.project_id] ?? ""
                : "";
            return `${chat.title ?? "Untitled chat"} ${projectName}`
                .toLowerCase()
                .includes(query);
        });

        return HISTORY_GROUPS.map((group) => ({
            ...group,
            chats: filteredChats.filter(
                (chat) => historyGroupFor(chat, now) === group.key,
            ),
        }));
    }, [chats, historyQuery, projectNames]);

    const hasVisibleHistory = groupedHistory.some(
        (group) => group.chats.length > 0,
    );

    const matchingProjects = useMemo(() => {
        const query = historyQuery.trim().toLowerCase();
        if (!query) return allProjects.slice(0, 5);
        return allProjects.filter((project) =>
            project.name.toLowerCase().includes(query),
        );
    }, [allProjects, historyQuery]);

    useEffect(() => {
        if (!user) return;
        listProjects()
            .then((projects) => {
                const map: Record<string, string> = {};
                for (const p of projects) map[p.id] = p.name;
                setProjectNames(map);
                setAllProjects(projects);
                setRecentProjects(
                    [...projects]
                        .sort(
                            (a, b) =>
                                Date.parse(b.updated_at || b.created_at) -
                                Date.parse(a.updated_at || a.created_at),
                        )
                        .slice(0, 5),
                );
            })
            .catch(() => {
                setProjectNames({});
                setAllProjects([]);
                setRecentProjects([]);
            });
    }, [user]);

    const handleToggle = () => {
        if (isOpen) setShouldAnimate(true);
        onToggle();
    };

    useEffect(() => {
        const handleClickOutside = () => setIsDropdownOpen(false);
        if (isDropdownOpen) {
            document.addEventListener("click", handleClickOutside);
            return () =>
                document.removeEventListener("click", handleClickOutside);
        }
    }, [isDropdownOpen]);

    useEffect(() => {
        const handleSearchShortcut = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                openSearch();
            }
        };

        window.addEventListener("keydown", handleSearchShortcut);
        return () => window.removeEventListener("keydown", handleSearchShortcut);
    }, [openSearch]);

    useEffect(() => {
        if (!isSearchOpen) return;

        const handleDialogKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeSearch();
                return;
            }

            if (event.key !== "Tab") return;
            const focusable = Array.from(
                searchDialogRef.current?.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
                ) ?? [],
            ).filter((element) => !element.hasAttribute("hidden"));
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleDialogKeyDown);
        return () => document.removeEventListener("keydown", handleDialogKeyDown);
    }, [closeSearch, isSearchOpen]);

    useEffect(() => {
        setCurrentChatId(routeChatId);
    }, [routeChatId, setCurrentChatId]);

    const getUserInitials = (email: string) => {
        if (profile?.displayName)
            return profile.displayName.charAt(0).toUpperCase();
        return email.charAt(0).toUpperCase();
    };

    const getDisplayName = () => {
        if (!profile) return "";
        return profile.displayName || user?.email?.split("@")[0] || "";
    };

    const getUserTier = () => {
        if (!profile) return "";
        return profile.tier || "Free";
    };

    if (!user) return null;

    return (
        <>
            {/* Mobile: tapping outside the expanded sidebar closes it. The
                sidebar (z-[99]) sits above this scrim (z-[98]); md+ is
                unaffected since the sidebar is part of the layout there. */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[98] bg-gray-300/20 md:hidden"
                    onClick={handleToggle}
                    aria-hidden="true"
                />
            )}
            <aside
                className={cn(
                    isOpen
                        ? "w-[274px] h-dvh bg-app-surface"
                        : "max-md:hidden w-14 h-dvh md:bg-app-surface bg-transparent pointer-events-none md:pointer-events-auto",
                    "vaultr-sidebar overflow-visible",
                    "flex flex-col absolute md:relative z-[99]",
                )}
                data-open={isOpen}
                aria-label="Vaultr navigation"
            >
                {/* Toggle + Logo */}
                <div
                    className={`vaultr-sidebar-header items-center justify-between px-4 py-2.5 ${
                        !isOpen ? "hidden md:flex" : "flex"
                    }`}
                >
                    {isOpen && (
                        <div>
                            <Link
                                href="/assistant"
                                    className="flex items-center transition-opacity hover:opacity-75"
                                >
                                    <span
                                        className={`vaultr-sidebar-logo text-[24px] font-medium font-serif ${
                                            shouldAnimate ? "sidebar-fade-in" : ""
                                        }`}
                                >
                                    Vaultr
                                </span>
                            </Link>
                        </div>
                    )}
                    <button
                        onClick={handleToggle}
                        className={cn(
                            "h-8 w-8 items-center justify-center flex rounded-lg transition-colors",
                            APP_SURFACE_HOVER_CLASS,
                        )}
                        title={isOpen ? "Close sidebar" : "Open sidebar"}
                    >
                        <MovingIcon name="panel-left" size={16} />
                    </button>
                </div>

                {isOpen && (
                    <div className="vaultr-sidebar-primary-actions px-2.5 pb-3">
                        <button
                            type="button"
                            onClick={() => router.push("/assistant")}
                            className="vaultr-sidebar-action vaultr-sidebar-action-primary"
                        >
                            <span className="vaultr-sidebar-action-icon">
                                <MovingIcon name="plus" size={18} />
                            </span>
                            <span>New chat</span>
                        </button>
                        <button
                            ref={searchTriggerRef}
                            type="button"
                            onClick={openSearch}
                            className={cn(
                                "vaultr-sidebar-action",
                                isSearchOpen && "vaultr-sidebar-action-active",
                            )}
                        >
                            <MovingIcon name="search" size={18} />
                            <span>Search</span>
                            <kbd>Ctrl K</kbd>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/account")}
                            className="vaultr-sidebar-action"
                        >
                            <MovingIcon name="settings" size={18} />
                            <span>Customize</span>
                        </button>
                    </div>
                )}

                {/* Nav items */}
                <nav className="vaultr-sidebar-nav">
                    {NAV_ITEMS.map(({ href, label, icon }) => {
                    const isActive =
                        href === "/assistant"
                            ? pathname === href
                            : href === "/projects"
                              ? pathname === href
                              : pathname === href ||
                                pathname.startsWith(href + "/");
                    return (
                        <div key={href} className="px-2.5">
                            <button
                                onClick={() => router.push(href)}
                                title={!isOpen ? label : ""}
                                className={cn(
                                    "vaultr-nav-item w-full h-9 flex items-center gap-3 px-2.5 rounded-lg text-left",
                                    isActive
                                        ? "vaultr-nav-item-active text-gray-900"
                                        : "text-gray-700",
                                    !isOpen ? "hidden md:flex" : "flex",
                                )}
                                aria-current={isActive ? "page" : undefined}
                            >
                                <MovingIcon
                                    name={icon}
                                    className="vaultr-sidebar-icon h-4 w-4 flex-shrink-0"
                                />
                                {isOpen && (
                                    <span
                                        className={`text-sm font-medium ${
                                            shouldAnimate
                                                ? "sidebar-fade-in-2"
                                                : ""
                                        }`}
                                    >
                                        {label}
                                    </span>
                                )}
                            </button>
                        </div>
                    );
                    })}
                </nav>

                {isOpen && (
                    <div className="vaultr-sidebar-sections mt-4 flex-1 min-h-0 flex flex-col gap-5">
                        {/* Recent Projects */}
                        <section
                            className={cn(
                                "vaultr-sidebar-section",
                                recentProjects?.length === 0 && "hidden",
                            )}
                        >
                            <button
                                onClick={() => setProjectsCollapsed((v) => !v)}
                                className={`vaultr-section-label mb-2 flex w-full items-center justify-between px-2.5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-700 ${
                                    shouldAnimate ? "sidebar-fade-in" : ""
                                }`}
                                aria-expanded={!projectsCollapsed}
                            >
                                <span>Projects</span>
                                <MovingIcon
                                    name="chevron-down"
                                    className={`h-3.5 w-3.5 transition-transform ${
                                        projectsCollapsed ? "-rotate-90" : ""
                                    }`}
                                />
                            </button>
                            {!projectsCollapsed && (
                                <>
                                    {!recentProjects ? (
                                        <div className="space-y-1 px-2.5">
                                            {[50, 65, 45].map((w, i) => (
                                                <div
                                                    key={i}
                                                    className="flex h-8 items-center rounded-md px-3"
                                                >
                                                    <div
                                                        className="h-3 bg-gray-200 rounded animate-pulse"
                                                        style={{
                                                            width: `${w}%`,
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : recentProjects.length === 0 ? (
                                        <div
                                            className={`px-2.5 py-2 text-xs text-gray-500 ${
                                                shouldAnimate
                                                    ? "sidebar-fade-in-2"
                                                    : ""
                                            }`}
                                        >
                                            No projects yet
                                        </div>
                                    ) : (
                                        <div
                                            className={`space-y-1 px-2.5 ${
                                                shouldAnimate
                                                    ? "sidebar-fade-in-2"
                                                    : ""
                                            }`}
                                        >
                                            {recentProjects.map((project) => {
                                                const isActive =
                                                    pathname ===
                                                        `/projects/${project.id}` ||
                                                    pathname.startsWith(
                                                        `/projects/${project.id}/`,
                                                    );
                                                return (
                                                    <button
                                                        key={project.id}
                                                        onClick={() =>
                                                            router.push(
                                                                `/projects/${project.id}`,
                                                            )
                                                        }
                                                        title={project.name}
                                                        className={cn(
                                                            "vaultr-project-item flex h-8 w-full items-center gap-2 rounded-md px-2.5 py-1 text-left text-xs transition-colors",
                                                            isActive
                                                                ? "vaultr-nav-item-active text-gray-900"
                                                                : "text-gray-700",
                                                        )}
                                                    >
                                                        <MovingIcon
                                                            name="folder"
                                                            className="vaultr-sidebar-icon h-3.5 w-3.5 shrink-0"
                                                        />
                                                        <span className="vaultr-history-title min-w-0 flex-1">
                                                            {project.name}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </section>

                        {/* Assistant History */}
                        <section className="vaultr-sidebar-section flex min-h-0 flex-1 flex-col">
                            <button
                                onClick={() => setHistoryCollapsed((v) => !v)}
                                className={`vaultr-section-label mb-2 flex w-full items-center justify-between px-2.5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-700 ${
                                    shouldAnimate ? "sidebar-fade-in" : ""
                                }`}
                                aria-expanded={!historyCollapsed}
                            >
                                <span>Chats</span>
                                <MovingIcon
                                    name="chevron-down"
                                    className={`h-3.5 w-3.5 transition-transform ${
                                        historyCollapsed ? "-rotate-90" : ""
                                    }`}
                                />
                            </button>
                            <div
                                className={`vaultr-history-scroll overflow-y-auto flex-1 ${
                                    historyCollapsed ? "hidden" : ""
                                }`}
                            >
                                {!chats ? (
                                    <div className="space-y-1.5 px-2.5">
                                        {[40, 60, 50, 70, 45].map((w, i) => (
                                            <div
                                                key={i}
                                                className="flex h-8 items-center rounded-md px-2.5"
                                            >
                                                <div className="mr-2 h-3.5 w-3.5 shrink-0 rounded bg-gray-200 animate-pulse" />
                                                <div
                                                    className="h-3 bg-gray-200 rounded animate-pulse"
                                                    style={{ width: `${w}%` }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : !hasVisibleHistory ? (
                                    <div
                                        className={`px-2.5 py-2 text-xs text-gray-500 ${
                                            shouldAnimate
                                                ? "sidebar-fade-in-2"
                                                : ""
                                        }`}
                                    >
                                        {historyQuery.trim()
                                            ? "No matching chats"
                                            : "No chats yet"}
                                    </div>
                                ) : (
                                    <>
                                        {groupedHistory.map((group) =>
                                            group.chats.length > 0 ? (
                                                <div
                                                    key={group.key}
                                                    className="vaultr-history-group"
                                                >
                                                    <button
                                                        type="button"
                                                        className="vaultr-history-group-header"
                                                        onClick={() =>
                                                            setCollapsedHistoryGroups(
                                                                (previous) => {
                                                                    const next =
                                                                        new Set(
                                                                            previous,
                                                                        );
                                                                    if (
                                                                        next.has(
                                                                            group.key,
                                                                        )
                                                                    ) {
                                                                        next.delete(
                                                                            group.key,
                                                                        );
                                                                    } else {
                                                                        next.add(
                                                                            group.key,
                                                                        );
                                                                    }
                                                                    return next;
                                                                },
                                                            )
                                                        }
                                                        aria-expanded={
                                                            !collapsedHistoryGroups.has(
                                                                group.key,
                                                            )
                                                        }
                                                    >
                                                        <span>{group.label}</span>
                                                        <span className="vaultr-history-count">
                                                            {group.chats.length}
                                                        </span>
                                                    </button>
                                                    {!collapsedHistoryGroups.has(
                                                        group.key,
                                                    ) && (
                                                        <div className="space-y-1.5 px-2.5">
                                                            {group.chats.map(
                                                                (chat) => (
                                                                    <SidebarChatItem
                                                                        key={
                                                                            chat.id
                                                                        }
                                                                        chat={
                                                                            chat
                                                                        }
                                                                        isActive={
                                                                            routeChatId ===
                                                                            chat.id
                                                                        }
                                                                        projectName={
                                                                            chat.project_id
                                                                                ? projectNames[
                                                                                      chat.project_id
                                                                                  ]
                                                                                : undefined
                                                                        }
                                                                        onSelect={() => {
                                                                            setCurrentChatId(
                                                                                chat.id,
                                                                            );
                                                                            router.push(
                                                                                chat.project_id
                                                                                    ? `/projects/${chat.project_id}/assistant/chat/${chat.id}`
                                                                                    : `/assistant/chat/${chat.id}`,
                                                                            );
                                                                        }}
                                                                    />
                                                                ),
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null,
                                        )}
                                        {hasMoreChats && (
                                            <div className="px-2.5 pt-1">
                                                <button
                                                    onClick={loadMoreChats}
                                                    className={cn(
                                                        "vaultr-nav-item flex h-9 w-full items-center justify-start rounded-md px-3 text-left text-xs font-medium text-gray-500 transition-colors hover:text-gray-700",
                                                    )}
                                                >
                                                    Load more
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {/* User Profile */}
                <div className="mt-auto p-1">
                    {user && (
                        <div className="relative">
                            <button
                                onClick={() =>
                                    setIsDropdownOpen(!isDropdownOpen)
                                }
                                className={cn(
                                    "flex items-center transition-colors w-full px-2.5 py-3 border-t",
                                    "rounded-xl border-white/60",
                                    !isOpen ? "hidden md:flex" : "",
                                    pathname === "/account" || isDropdownOpen
                                        ? APP_SURFACE_ACTIVE_CLASS
                                        : APP_SURFACE_HOVER_CLASS,
                                )}
                                title={!isOpen ? user.email : undefined}
                                aria-expanded={isDropdownOpen}
                                aria-label={
                                    isOpen
                                        ? `${getDisplayName()} account menu`
                                        : "Open account menu"
                                }
                            >
                                <div className="h-6.5 w-6.5 flex-shrink-0 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-medium font-serif">
                                    {getUserInitials(user.email)}
                                </div>
                                {isOpen && (
                                    <div
                                        className={`text-left flex-1 min-w-0 pl-3 flex items-center justify-between gap-2 ${
                                            shouldAnimate
                                                ? "sidebar-fade-in-2"
                                                : ""
                                        }`}
                                    >
                                        <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                                            <div className="truncate text-sm font-medium leading-none text-gray-900">
                                                {getDisplayName()}
                                            </div>
                                            <div className="truncate text-[12px] leading-none text-gray-500">
                                                {getUserTier()}
                                            </div>
                                        </div>
                                        <MovingIcon
                                            name="chevron-down"
                                            className="h-4 w-4 flex-shrink-0 text-gray-400"
                                        />
                                    </div>
                                )}
                            </button>

                            {isDropdownOpen && (
                                <div
                                    className={cn(
                                        "absolute bottom-full left-0 z-50 mb-1 p-1 whitespace-nowrap",
                                        isOpen ? "right-0" : "w-56",
                                        "bg-app-floating rounded-xl shadow-[0_6px_17px_rgba(15,23,42,0.1)] border border-white/70 backdrop-blur-xl",
                                    )}
                                >
                                    <button
                                        onClick={() => {
                                            router.push("/account");
                                            setIsDropdownOpen(false);
                                        }}
                                        className={cn(
                                            "w-full px-4 py-2 text-left text-sm text-gray-700 flex items-center gap-2 rounded-md",
                                            "hover:bg-white",
                                        )}
                                    >
                                        <MovingIcon name="user" size={16} />
                                        Account Settings
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {isSearchOpen && (
                    <div
                        className="vaultr-search-scrim fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[25vh]"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                closeSearch();
                            }
                        }}
                    >
                        <div
                            ref={searchDialogRef}
                            className="vaultr-search-dialog w-full max-w-[640px] overflow-hidden rounded-2xl"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Search chats and projects"
                        >
                            <div className="vaultr-search-dialog-input flex items-center gap-3 px-5">
                                <MovingIcon name="search" size={20} />
                                <input
                                    autoFocus
                                    value={historyQuery}
                                    onChange={(event) => setHistoryQuery(event.target.value)}
                                    placeholder="Search chats and projects"
                                    className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none"
                                />
                                        <button
                                            type="button"
                                            onClick={closeSearch}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg"
                                            aria-label="Close search"
                                >
                                    <MovingIcon name="x" size={20} />
                                </button>
                            </div>
                            <div className="max-h-[360px] overflow-y-auto p-2">
                                {matchingProjects.length === 0 &&
                                groupedHistory.flatMap((group) => group.chats).length === 0 ? (
                                    <p className="px-3 py-8 text-center text-sm text-[var(--vaultr-secondary)]">
                                        No matching chats or projects
                                    </p>
                                ) : (
                                    <>
                                        {matchingProjects.length > 0 && (
                                            <section aria-labelledby="search-projects-heading">
                                                <h2
                                                    id="search-projects-heading"
                                                    className="px-3 pb-1 pt-2 text-xs font-medium text-[var(--vaultr-secondary)]"
                                                >
                                                    Projects
                                                </h2>
                                                {matchingProjects.map((project) => (
                                                    <button
                                                        key={project.id}
                                                        type="button"
                                                        className="vaultr-search-result flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left"
                                                        onClick={() => {
                                                            setIsSearchOpen(false);
                                                            router.push(`/projects/${project.id}`);
                                                        }}
                                                    >
                                                        <MovingIcon name="folder" size={16} />
                                                        <span className="truncate text-sm">{project.name}</span>
                                                    </button>
                                                ))}
                                            </section>
                                        )}
                                        {groupedHistory.flatMap((group) => group.chats).length > 0 && (
                                            <section aria-labelledby="search-chats-heading">
                                                <h2
                                                    id="search-chats-heading"
                                                    className="px-3 pb-1 pt-3 text-xs font-medium text-[var(--vaultr-secondary)]"
                                                >
                                                    Chats
                                                </h2>
                                                {groupedHistory.flatMap((group) => group.chats).map((chat) => (
                                                    <button
                                                        key={chat.id}
                                                        type="button"
                                                        className="vaultr-search-result flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left"
                                                        onClick={() => {
                                                            setIsSearchOpen(false);
                                                            setCurrentChatId(chat.id);
                                                            router.push(
                                                                chat.project_id
                                                                    ? `/projects/${chat.project_id}/assistant/chat/${chat.id}`
                                                                    : `/assistant/chat/${chat.id}`,
                                                            );
                                                        }}
                                                    >
                                                        <MovingIcon name="message-square" size={16} />
                                                        <span className="truncate text-sm">
                                                            {chat.title || "Untitled chat"}
                                                        </span>
                                                    </button>
                                                ))}
                                            </section>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </aside>
        </>
    );
}


