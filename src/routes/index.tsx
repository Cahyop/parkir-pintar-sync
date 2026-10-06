import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kasir Parkir — Tiket, Scan QR & Rekap Kas" },
      { name: "description", content: "Aplikasi kasir parkir: cetak tiket Bluetooth, scan QR keluar, rekap kas harian realtime." },
      { property: "og:title", content: "Kasir Parkir" },
      { property: "og:description", content: "Cetak tiket, scan QR keluar, rekap kas harian realtime." },
    ],
  }),
  beforeLoad: () => { throw redirect({ to: "/masuk" }); },
});
