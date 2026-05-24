"use client";

export function ErrorState({
  message,
  action
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-[28px] border border-coral/20 bg-coral/10 p-6 text-sm text-coral">
      <p>{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
