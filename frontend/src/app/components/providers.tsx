"use client";

import { Suspense, useSyncExternalStore } from "react";
import { AuthProvider } from "@/app/contexts/AuthContext";
import { UserProfileProvider } from "@/app/contexts/UserProfileContext";
import { MfaLoginGate } from "@/app/components/shared/MfaLoginGate";
import { FullScreenLoader } from "@/app/components/shared/FullScreenLoader";

const noopSubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function Providers({ children }: { children: React.ReactNode }) {
    const isClient = useSyncExternalStore(
        noopSubscribe,
        getClientSnapshot,
        getServerSnapshot,
    );

    if (!isClient) {
        return <FullScreenLoader />;
    }

    return (
        <AuthProvider>
            <UserProfileProvider>
                <Suspense fallback={<FullScreenLoader />}>
                    <MfaLoginGate>{children}</MfaLoginGate>
                </Suspense>
            </UserProfileProvider>
        </AuthProvider>
    );
}
