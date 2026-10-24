"use client";

import { ErrorState } from "@/components/states";

export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorState onRetry={retry} />;
}
