"use client";

import { ErrorState } from "@/components/states";

export default function OnboardingError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-14 md:px-6">
      <ErrorState onRetry={retry} />
    </main>
  );
}
