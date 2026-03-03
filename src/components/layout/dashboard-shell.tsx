"use client";

import { useState, useRef } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { VoiceTransactionAgent, type AgentState } from "@/components/voice/voice-transaction-agent";

export function DashboardShell({ children }: { children: React.ReactNode }) {
    const [micState, setMicState] = useState<AgentState>("idle");
    const micClickRef = useRef<(() => void) | null>(null);

    return (
        <>
            <div className="relative flex-1 pb-28 md:pb-0">
                {children}
            </div>
            <VoiceTransactionAgent
                onStateChange={setMicState}
                onMicClickRef={micClickRef}
            />
            <MobileNav
                onMicClick={() => micClickRef.current?.()}
                micState={micState}
            />
        </>
    );
}
