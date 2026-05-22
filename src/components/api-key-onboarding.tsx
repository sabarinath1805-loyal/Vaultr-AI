"use client";

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ALL_API_KEY_NAMES,
  API_KEY_LABELS,
  OPTIONAL_API_KEY_NAMES,
  REQUIRED_API_KEY_NAMES,
  isTauriDesktop,
  type ClientApiKeyStatus,
  type ClientApiKeyValues,
} from "@/lib/tauri-client";

const emptyStatus = ALL_API_KEY_NAMES.reduce<ClientApiKeyStatus>((acc, name) => {
  acc[name] = false;
  return acc;
}, {} as ClientApiKeyStatus);

export function ApiKeyOnboarding({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<ClientApiKeyStatus>(emptyStatus);
  const [formValues, setFormValues] = useState<ClientApiKeyValues>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = isTauriDesktop();
  const requiredConfigured = useMemo(
    () => REQUIRED_API_KEY_NAMES.every((name) => status[name]),
    [status]
  );

  useEffect(() => {
    if (!desktop) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    invoke<Partial<ClientApiKeyStatus>>("get_api_key_status")
      .then((keys) => {
        if (cancelled) return;
        setStatus({ ...emptyStatus, ...keys });
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Vaultr could not read saved API keys.");
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [desktop]);

  if (!desktop || checking || requiredConfigured) {
    return <>{children}</>;
  }

  const saveKeys = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const savedStatus = await invoke<Partial<ClientApiKeyStatus>>("save_api_keys", {
        keys: formValues,
      });
      const nextStatus = { ...emptyStatus, ...savedStatus };
      setStatus(nextStatus);
      if (!REQUIRED_API_KEY_NAMES.every((name) => nextStatus[name])) {
        setError("Groq and Serper keys are required for Cloud Mode legal research.");
      }
    } catch {
      setError("Vaultr could not save these keys. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 text-[var(--text)]">
      <div className="w-full max-w-[520px] rounded-[24px] border border-[var(--border)] bg-[var(--bg)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
        <p className="text-[13px] text-[var(--text-muted)]">Welcome to Vaultr</p>
        <h1 className="mt-2 text-[30px] font-normal tracking-[-0.04em] text-[var(--text)]">
          Add API keys to enable Cloud Mode
        </h1>
        <p className="mt-3 text-[14px] leading-6 text-[var(--text-muted)]">
          Vaultr stores these keys locally in your app data folder. Groq powers Lex chat
          and Contract Scanner; Serper powers verified legal web search.
        </p>

        <form onSubmit={saveKeys} className="mt-8 space-y-4">
          {ALL_API_KEY_NAMES.map((name) => (
            <label key={name} className="block">
              <span className="mb-1.5 flex items-center justify-between text-[13px] text-[var(--text)]">
                {API_KEY_LABELS[name]}
                {OPTIONAL_API_KEY_NAMES.includes(name as (typeof OPTIONAL_API_KEY_NAMES)[number]) ? (
                  <span className="text-[12px] text-[var(--text-muted)]">Optional</span>
                ) : null}
              </span>
              <Input
                type="password"
                value={formValues[name] || ""}
                placeholder={status[name] ? "Already saved" : "Paste key"}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    [name]: event.target.value,
                  }))
                }
                className="h-11 rounded-xl border-[var(--border)] bg-[var(--bg)]"
              />
            </label>
          ))}

          {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}

          <Button type="submit" disabled={saving} className="h-11 w-full rounded-xl">
            {saving ? "Saving..." : "Save and launch Vaultr"}
          </Button>
        </form>
      </div>
    </div>
  );
}
