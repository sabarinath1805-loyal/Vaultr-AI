"use client";

import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Briefcase,
  ChevronRight,
  FileText,
  Lock,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const ONBOARDING_KEY = "vaultr_user_profile";

const JURISDICTIONS = [
  { id: "sg", label: "Singapore" },
  { id: "uk", label: "United Kingdom" },
  { id: "au", label: "Australia" },
  { id: "us", label: "United States" },
  { id: "my", label: "Malaysia" },
  { id: "eu", label: "European Union" },
  { id: "in", label: "India" },
  { id: "other", label: "Other" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export function hasCompletedOnboarding(): boolean {
  try {
    const profile = JSON.parse(localStorage.getItem(ONBOARDING_KEY) || "{}");
    return profile.onboardingComplete === true;
  } catch {
    return false;
  }
}

export function completeOnboarding(
  name: string,
  firm: string,
  jurisdiction: string
) {
  localStorage.setItem(
    ONBOARDING_KEY,
    JSON.stringify({
      name,
      firm,
      jurisdiction,
      onboardingComplete: true,
      completedAt: new Date().toISOString(),
    })
  );
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}

/* ------------------------------------------------------------------ */
/*  Onboarding Modal                                                   */
/* ------------------------------------------------------------------ */

export function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const containerRef = useRef<HTMLDivElement>(null);

  const totalSteps = 9;

  const goNext = () => {
    if (step === 7) {
      const newErrors: Record<string, boolean> = {};
      if (!name.trim()) newErrors.name = true;
      if (!firm.trim()) newErrors.firm = true;
      if (!jurisdiction) newErrors.jurisdiction = true;
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
      setErrors({});
    }
    setDirection("forward");
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const goBack = () => {
    setDirection("back");
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleComplete = () => {
    completeOnboarding(name, firm, jurisdiction);
    onComplete();
  };

  const skip = () => {
    completeOnboarding("", "", "");
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-[var(--card-bg)] p-10 shadow-2xl">
        {/* Skip button */}
        <button
          type="button"
          onClick={skip}
          className="absolute right-4 top-4 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          Skip
        </button>

        {/* Content with transition */}
        <div
          ref={containerRef}
          key={step}
          className="animate-fade-in"
          style={{
            animation: `${direction === "forward" ? "slideInRight" : "slideInLeft"} 200ms ease`,
          }}
        >
          {step === 0 && <ScreenWelcome />}
          {step === 1 && <ScreenMeetLex />}
          {step === 2 && <ScreenMatters />}
          {step === 3 && <ScreenVault />}
          {step === 4 && <ScreenAgent />}
          {step === 5 && <ScreenContractScanner />}
          {step === 6 && <ScreenTabularReview />}
          {step === 7 && (
            <ScreenProfile
              name={name}
              setName={setName}
              firm={firm}
              setFirm={setFirm}
              jurisdiction={jurisdiction}
              setJurisdiction={setJurisdiction}
              errors={errors}
            />
          )}
          {step === 8 && <ScreenReady name={name} />}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          {step < totalSteps - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl bg-[var(--text)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              {step === 0 ? (
                <span className="flex items-center gap-1">
                  Get started <ChevronRight className="h-4 w-4" />
                </span>
              ) : (
                "Next"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              className="rounded-xl bg-[var(--text)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              Open Vaultr →
            </button>
          )}
        </div>

        {/* Progress dots */}
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step ? "bg-[#5c5248]" : "bg-[var(--border)]"
              }`}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Screens                                                             */
/* ------------------------------------------------------------------ */

function ScreenWelcome() {
  return (
    <div className="text-center">
      <span className="inline-block animate-[lex-breathe_4s_ease-in-out_infinite] text-[48px] leading-none text-[#3a3632]" style={{ fontFamily: "serif", fontWeight: 300 }}>
        ✳
      </span>
      <h1 className="mt-4 text-3xl font-normal text-[var(--text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
        Welcome, Counselor.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]" style={{ fontFamily: "'Sora', sans-serif" }}>
        Vaultr is your private AI legal workspace. Let&apos;s show you around.
      </p>
    </div>
  );
}

function ScreenMeetLex() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Brain className="h-6 w-6 text-[var(--text)]" />
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Intelligence</span>
      </div>
      <h2 className="text-3xl font-normal text-[var(--text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
        Meet Lex, your AI counsel.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]" style={{ fontFamily: "'Sora', sans-serif" }}>
        Lex is a jurisdiction-aware legal AI with four intelligence tiers — from fast answers to deep autonomous research. All responses cite real cases and statutes.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          { tier: "Lex Core", desc: "Fast answers, low complexity" },
          { tier: "Lex Pro", desc: "Balanced research" },
          { tier: "Lex Ultra", desc: "Deep analysis" },
          { tier: "Lex Max", desc: "Autonomous agent" },
        ].map((m) => (
          <div key={m.tier} className="rounded-xl border border-[var(--border)] p-4 transition-colors hover:bg-[var(--hover)]">
            <div className="text-sm font-medium text-[var(--text)]">{m.tier}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">{m.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenMatters() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Briefcase className="h-6 w-6 text-[var(--text)]" />
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Case Management</span>
      </div>
      <h2 className="text-3xl font-normal text-[var(--text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
        Case management, reimagined.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]" style={{ fontFamily: "'Sora', sans-serif" }}>
        Matters organises your cases end-to-end — parties, key dates, documents, billing, and AI-powered analysis. Ask Lex about any matter directly.
      </p>
      <div className="mt-5 rounded-xl border border-[var(--border)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[var(--text)]">Smith v. National Insurance Co.</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">3 parties · 2 key dates · 5 documents</div>
          </div>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Active</span>
        </div>
      </div>
    </div>
  );
}

function ScreenVault() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Lock className="h-6 w-6 text-[var(--text)]" />
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Privacy</span>
      </div>
      <h2 className="text-3xl font-normal text-[var(--text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
        Your private document vault.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]" style={{ fontFamily: "'Sora', sans-serif" }}>
        Upload contracts, judgments, and briefs. Lex reads them semantically and surfaces relevant clauses when you need them — nothing leaves your device.
      </p>
      <div className="mt-5 space-y-2">
        {["Employment_Agreement_2024.pdf", "NDA_Mutual_Draft_v3.docx", "Court_Order_12Jan.pdf"].map((f) => (
          <div key={f} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
            <FileText className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text)]">{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenAgent() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-6 w-6 text-amber-400" />
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Agent Mode</span>
      </div>
      <h2 className="text-3xl font-normal text-[var(--text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
        Autonomous legal research.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]" style={{ fontFamily: "'Sora', sans-serif" }}>
        Lex Agent breaks down complex legal questions, searches 15+ databases, fetches case excerpts, and synthesises a comprehensive answer — all in under 3 minutes.
      </p>
      <div className="mt-5 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-600">✓</span>
          <span className="text-[var(--text-muted)]">Analysed query</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-600">✓</span>
          <span className="text-[var(--text-muted)]">Searched legal databases</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--text-muted)] border-t-transparent" />
          <span className="font-medium text-[var(--text)]">Drafting response...</span>
        </div>
      </div>
    </div>
  );
}

function ScreenContractScanner() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-6 w-6 text-[var(--text)]" />
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Contract Review</span>
      </div>
      <h2 className="text-3xl font-normal text-[var(--text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
        AI contract review in seconds.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]" style={{ fontFamily: "'Sora', sans-serif" }}>
        Upload any contract and Lex identifies risks, flags unusual clauses, and suggests protective provisions — jurisdiction-aware.
      </p>
    </div>
  );
}

function ScreenTabularReview() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-6 w-6 text-[var(--text)]" />
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Tabular Review</span>
      </div>
      <h2 className="text-3xl font-normal text-[var(--text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
        Bulk document analysis.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]" style={{ fontFamily: "'Sora', sans-serif" }}>
        Upload 40 contracts, define columns, Lex fills the table. Export to Excel in minutes.
      </p>
    </div>
  );
}

function ScreenProfile({
  name,
  setName,
  firm,
  setFirm,
  jurisdiction,
  setJurisdiction,
  errors,
}: {
  name: string;
  setName: (v: string) => void;
  firm: string;
  setFirm: (v: string) => void;
  jurisdiction: string;
  setJurisdiction: (v: string) => void;
  errors: Record<string, boolean>;
}) {
  return (
    <div>
      <h2 className="text-3xl font-normal text-[var(--text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
        One last thing.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]" style={{ fontFamily: "'Sora', sans-serif" }}>
        Help Lex personalise your experience.
      </p>
      <div className="mt-6 space-y-4">
        <div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sarah Chen"
            className={`w-full rounded-xl border px-4 py-3 text-sm text-[var(--text)] outline-none transition-colors ${
              errors.name ? "border-red-400" : "border-[var(--border)]"
            }`}
          />
          {errors.name && <div className="mt-1 text-xs text-red-500">Name is required</div>}
        </div>
        <div>
          <input
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
            placeholder="Chen & Partners LLP"
            className={`w-full rounded-xl border px-4 py-3 text-sm text-[var(--text)] outline-none transition-colors ${
              errors.firm ? "border-red-400" : "border-[var(--border)]"
            }`}
          />
          {errors.firm && <div className="mt-1 text-xs text-red-500">Firm name is required</div>}
        </div>
        <div>
          <select
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            className={`w-full appearance-none rounded-xl border bg-transparent px-4 py-3 text-sm text-[var(--text)] outline-none transition-colors ${
              errors.jurisdiction ? "border-red-400" : "border-[var(--border)]"
            }`}
          >
            <option value="">Select jurisdiction</option>
            {JURISDICTIONS.map((j) => (
              <option key={j.id} value={j.id}>{j.label}</option>
            ))}
          </select>
          {errors.jurisdiction && <div className="mt-1 text-xs text-red-500">Jurisdiction is required</div>}
        </div>
      </div>
    </div>
  );
}

function ScreenReady({ name }: { name: string }) {
  return (
    <div className="text-center">
      <span className="inline-block animate-[lex-breathe_4s_ease-in-out_infinite] text-[48px] leading-none text-[#3a3632]" style={{ fontFamily: "serif", fontWeight: 300 }}>
        ✳
      </span>
      <h1 className="mt-4 text-3xl font-normal text-[var(--text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
        You&apos;re all set{name ? `, ${name}` : ""}.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]" style={{ fontFamily: "'Sora', sans-serif" }}>
        Lex is ready when you are.
      </p>
    </div>
  );
}
