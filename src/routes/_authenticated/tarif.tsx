import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { tariffsQuery, settingsQuery } from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/tarif")({
  head: () => ({ meta: [{ title: "Master Tarif — Kasir Parkir" }] }),
  component: Tarif,
});

function Tarif() {
  const qc = useQueryClient();
  const { data: tariffs = [] } = useQuery(tariffsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const [loc, setLoc] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eAmount, setEAmount] = useState("");

  useEffect(() => { if (settings) setLoc(settings.location_name); }, [settings]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["tariffs"] });

  async function add() {
    const a = parseInt(amount, 10);
    if (!name.trim() || isNaN(a) || a < 0) { toast.error("Isi nama dan tarif"); return; }
    const { error } = await supabase.from("tariffs").insert({ name: name.trim(), amount: a });
    if (error) { toast.error(error.message); return; }
    setName(""); setAmount(""); refresh(); toast.success("Kategori ditambahkan");
  }
  async function save(id: string) {
    const a = parseInt(eAmount, 10);
    if (!eName.trim() || isNaN(a) || a < 0) { toast.error("Data tidak valid"); return; }
    const { error } = await supabase.from("tariffs").update({ name: eName.trim(), amount: a }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditId(null); refresh();
  }
  async function remove(id: string, n: string) {
    if (!confirm(`Hapus kategori "${n}"?`)) return;
    const { error } = await supabase.from("tariffs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function saveLoc() {
    const { error } = await supabase.from("app_settings").upsert({ id: 1, location_name: loc.trim() || "Parkir" });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Nama lokasi disimpan");
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-bold">Master Tarif</h1>
        <p className="text-sm text-muted-foreground">Kategori kendaraan & tarif flat</p>
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-card p-4">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Nama lokasi parkir (di struk)</label>
        <div className="flex gap-2">
          <Input value={loc} onChange={(e) => setLoc(e.target.value)} />
          <Button onClick={saveLoc}>Simpan</Button>
        </div>
      </section>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {tariffs.map((t) => (
          <li key={t.id} className="flex items-center gap-2 p-3">
            {editId === t.id ? (
              <>
                <Input value={eName} onChange={(e) => setEName(e.target.value)} className="flex-1" />
                <Input value={eAmount} onChange={(e) => setEAmount(e.target.value)} inputMode="numeric" className="w-24 font-mono" />
                <Button size="icon" onClick={() => save(t.id)} aria-label="Simpan"><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setEditId(null)} aria-label="Batal"><X className="h-4 w-4" /></Button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <div className="font-semibold">{t.name}</div>
                  <div className="font-mono text-primary">{rupiah(t.amount)}</div>
                </div>
                <Button size="icon" variant="ghost" aria-label="Edit"
                  onClick={() => { setEditId(t.id); setEName(t.name); setEAmount(String(t.amount)); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Hapus" onClick={() => remove(t.id, t.name)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </li>
        ))}
        {tariffs.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Belum ada kategori</li>}
      </ul>

      <section className="space-y-2 rounded-lg border border-dashed border-border p-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tambah kategori</div>
        <Input placeholder="Nama (mis. Sepeda)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Tarif (Rp)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} className="font-mono" />
        <Button onClick={add} className="w-full"><Plus className="mr-2 h-4 w-4" /> Tambah</Button>
      </section>
    </div>
  );
}
