import type { Metadata } from "next";
import { AccountPreview } from "./preview";

export const metadata: Metadata = { title: "Account preview", robots: { index: false } };

export default function AccountPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-12">
      <h1 className="text-3xl font-bold">My boxes</h1>
      <h2 className="text-xl font-semibold">Monts d&apos;Arrée Farm Co-op: Family box, €29.00 a week</h2>
      <AccountPreview />
    </main>
  );
}
