"use client";

import { useState } from "react";
import { safeStorage } from "@/lib/safe-storage";

const JURISDICTIONS = [
  { id: "sg", label: "Singapore" },
  { id: "gb", label: "United Kingdom" },
  { id: "au", label: "Australia" },
  { id: "my", label: "Malaysia" },
  { id: "other", label: "Other" },
];

const PRACTICE_AREAS = [
  "Corporate & Commercial",
  "Litigation & Dispute Resolution",
  "Real Estate",
  "Employment",
  "IP",
  "Criminal",
  "Family",
  "Other",
];

const REFERRAL_SOURCES = ["Referral", "LinkedIn", "Google", "Other"];

const ONBOARDING_KEY = "vaultr-onboarding-completed";

export function hasCompletedOnboarding(): boolean {
  return safeStorage.getItem(ONBOARDING_KEY) === "true";
}

export function completeOnboarding(
  jurisdiction: string,
  practiceArea: string,
  referralSource: string
) {
  safeStorage.setItem(ONBOARDING_KEY, "true");
  safeStorage.setItem("vaultr-onboarding-jurisdiction", jurisdiction);
  safeStorage.setItem("vaultr-onboarding-practice-area", practiceArea);
  safeStorage.setItem("vaultr-onboarding-referral", referralSource);
}

export function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [jurisdiction, setJurisdiction] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [referralSource, setReferralSource] = useState("");

  const handleComplete = () => {
    completeOnboarding(jurisdiction, practiceArea, referralSource);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f5f0eb]/95 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-10 shadow-2xl">
        <div className="mb-6 text-center">
          <span
            style={{
              fontSize: "48px",
              fontFamily: "serif",
              lineHeight: 1,
              color: "#3a3632",
              fontWeight: 300,
            }}
          >
            ✳
          </span>
          <h1
            className="mt-3 text-[32px] font-normal text-[var(--text)]"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Welcome, Counselor.
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Step {step} of 3
          </p>
        </div>

        {step === 1 && (
          <div>
            <h2 className="mb-4 text-[15px] font-medium text-[var(--text)]">
              What is your primary jurisdiction?
            </h2>
            <div className="space-y-2">
              {JURISDICTIONS.map((j) => (
                <label
                  key={j.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-[14px] transition-colors ${
                    jurisdiction === j.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="jurisdiction"
                    value={j.id}
                    checked={jurisdiction === j.id}
                    onChange={() => setJurisdiction(j.id)}
                    className="accent-[var(--accent)]"
                  />
                  {j.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="mb-4 text-[15px] font-medium text-[var(--text)]">
              What is your practice area?
            </h2>
            <div className="space-y-2">
              {PRACTICE_AREAS.map((area) => (
                <label
                  key={area}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-[14px] transition-colors ${
                    practiceArea === area
                      ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="practiceArea"
                    value={area}
                    checked={practiceArea === area}
                    onChange={() => setPracticeArea(area)}
                    className="accent-[var(--accent)]"
                  />
                  {area}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="mb-4 text-[15px] font-medium text-[var(--text)]">
              How did you hear about Vaultr?
            </h2>
            <div className="space-y-2">
              {REFERRAL_SOURCES.map((source) => (
                <label
                  key={source}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-[14px] transition-colors ${
                    referralSource === source
                      ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="referralSource"
                    value={source}
                    checked={referralSource === source}
                    onChange={() => setReferralSource(source)}
                    className="accent-[var(--accent)]"
                  />
                  {source}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)]"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && !jurisdiction) ||
                (step === 2 && !practiceArea)
              }
              className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-[13px] text-[var(--bg-primary)] transition-colors hover:opacity-80 disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={!referralSource}
              className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-[13px] text-[var(--bg-primary)] transition-colors hover:opacity-80 disabled:opacity-40"
            >
              Get Started
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
