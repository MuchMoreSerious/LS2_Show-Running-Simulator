"use client";

import { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-booth-raised border border-hairline rounded-lg ${className}`}>{children}</div>
  );
}

export function PanelHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
      <h2 className="text-xs font-mono tracking-[0.15em] text-ink-dim uppercase">{children}</h2>
      {right}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "amber" | "green" | "red" | "blue" | "dim"; children: ReactNode }) {
  const tones = {
    amber: "bg-tally-amber/15 text-tally-amber border-tally-amber/30",
    green: "bg-tally-green/15 text-tally-green border-tally-green/30",
    red: "bg-tally-red/15 text-tally-red border-tally-red/30",
    blue: "bg-cue-blue/15 text-cue-blue border-cue-blue/30",
    dim: "bg-booth-inset text-ink-dim border-hairline",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children, onClick, variant = "default", disabled = false, type = "button", className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "go" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const variants = {
    default: "bg-booth-inset border border-hairline hover:border-ink-dim text-ink",
    go: "bg-tally-green/90 hover:bg-tally-green text-booth font-semibold",
    danger: "bg-tally-red/90 hover:bg-tally-red text-booth font-semibold",
    ghost: "bg-transparent hover:bg-booth-inset text-ink-dim hover:text-ink",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-dim mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-dim/70 mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full bg-booth-inset border border-hairline rounded px-3 py-2 text-sm text-ink placeholder:text-ink-dim/50 focus:border-tally-amber focus:outline-none";

export function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-hairline border-t-tally-amber rounded-full animate-spin align-middle" aria-label="로딩 중" />
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-tally-red/10 border border-tally-red/30 rounded p-3 text-sm text-tally-red">
      <span className="tally tally-stop mt-1.5" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function ScoreBar({ value, tone = "green" }: { value: number; tone?: "green" | "amber" | "red" }) {
  const color = tone === "green" ? "var(--tally-green)" : tone === "amber" ? "var(--tally-amber)" : "var(--tally-red)";
  return (
    <div className="scorebar">
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export function scoreTone(v: number): "green" | "amber" | "red" {
  if (v >= 75) return "green";
  if (v >= 50) return "amber";
  return "red";
}
