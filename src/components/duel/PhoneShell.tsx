import type { ReactNode } from "react";

/** Mobile-first column, centred on larger screens. */
export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-8 pt-6">
        {children}
      </div>
    </div>
  );
}
