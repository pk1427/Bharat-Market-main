"use client";

import { toast } from "sonner";

const SETTLED_TX_TOAST_DURATION_MS = 12_000;

export function getExplorerTxUrl(hash: string) {
  return `https://amoy.polygonscan.com/tx/${hash}`;
}

function ExplorerLink({ hash }: { hash: string }) {
  return (
    <a
      href={getExplorerTxUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className="text-xs font-semibold text-gold underline-offset-2 hover:underline"
    >
      View on PolygonScan
    </a>
  );
}

export function handleTxToast({
  hash,
  pendingLabel
}: {
  hash: string;
  pendingLabel: string;
}) {
  return toast.loading(pendingLabel, {
    description: <ExplorerLink hash={hash} />,
    duration: Infinity
  });
}

export function settleTxToast({
  id,
  hash,
  successLabel,
  errorLabel,
  status
}: {
  id: string | number;
  hash: string;
  successLabel: string;
  errorLabel: string;
  status: "success" | "error";
}) {
  if (status === "success") {
    toast.success(successLabel, {
      id,
      description: <ExplorerLink hash={hash} />,
      duration: SETTLED_TX_TOAST_DURATION_MS
    });
    return;
  }

  toast.error(errorLabel, {
    id,
    description: <ExplorerLink hash={hash} />,
    duration: SETTLED_TX_TOAST_DURATION_MS
  });
}

export function failTxToast(message: string) {
  toast.error(message, {
    duration: SETTLED_TX_TOAST_DURATION_MS
  });
}

export function dismissTxToast(id: string | number | null) {
  if (id !== null) {
    toast.dismiss(id);
  }
}
