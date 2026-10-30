import type { Metadata } from "next";
import { ShopPreview } from "./preview";

export const metadata: Metadata = { title: "Shop preview", robots: { index: false } };

export default function ShopPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-12">
      <h1 className="text-3xl font-bold">Monts d&apos;Arrée Farm Co-op</h1>
      <ShopPreview />
    </main>
  );
}
