"use client";

import { useEffect, useState } from "react";

import { formatCountdown } from "@/lib/format";

export function Countdown({ endTime }: { endTime: bigint }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return <span>{formatCountdown(endTime, now)}</span>;
}
