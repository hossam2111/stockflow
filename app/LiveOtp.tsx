"use client";

import { useEffect, useState } from "react";
import { generateTotp, isValidBase32Secret } from "@/lib/totp";

export function LiveOtp({ secret }: { secret: string }) {
  const [code, setCode] = useState<string>("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    if (!secret || !isValidBase32Secret(secret)) return;

    let active = true;

    const tick = async () => {
      try {
        const result = await generateTotp(secret);
        if (!active) return;
        setCode(result.code);
        setSecondsRemaining(result.secondsRemaining);
      } catch {
        // ignore errors (e.g. invalid secret) and keep last known state
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [secret]);

  if (!secret || !isValidBase32Secret(secret)) return null;

  const formatted =
    code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

  return (
    <span
      className="liveOtp"
      dir="rtl"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.875rem",
      }}
    >
      <span style={{ color: "#6b7280" }}>كود OTP الحالي:</span>
      <span
        style={{
          fontFamily: "monospace",
          fontWeight: "bold",
          fontSize: "1.05rem",
          letterSpacing: "0.05em",
        }}
      >
        {formatted}
      </span>
      <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
        متبقٍ {secondsRemaining}s
      </span>
    </span>
  );
}
