"use client";

export function ErrorState({
  message,
  action
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-[28px] border border-coral/20 bg-coral/10 p-5 text-sm text-coral sm:p-6">
      <p>{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
