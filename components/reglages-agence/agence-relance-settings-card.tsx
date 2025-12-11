// components/reglages/agence-relance-settings-card.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const supabase = createClient();

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type AgenceSettingsRow = {
  id: string;
  relance_seuil_1: number;
  relance_seuil_2: number;
  relance_seuil_3: number;
};

/* -------------------------------------------------------------------------- */
/*                            COMPOSANT PRINCIPAL                             */
/* -------------------------------------------------------------------------- */

export function AgenceRelanceSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rowId, setRowId] = useState<string | null>(null);

  const [seuil1, setSeuil1] = useState<string>("7");
  const [seuil2, setSeuil2] = useState<string>("14");
  const [seuil3, setSeuil3] = useState<string>("30");

  /* ------------------------- Chargement initial ------------------------- */

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("agence_settings")
          .select("id, relance_seuil_1, relance_seuil_2, relance_seuil_3")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error(error);
          toast.error("Impossible de charger les réglages de relance");
          return;
        }

        if (data) {
          const settings = data as AgenceSettingsRow;
          setRowId(settings.id);
          setSeuil1(String(settings.relance_seuil_1));
          setSeuil2(String(settings.relance_seuil_2));
          setSeuil3(String(settings.relance_seuil_3));
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchSettings();
  }, []);

  /* ----------------------------- Helpers UI ----------------------------- */

  const resetDefaults = () => {
    setSeuil1("7");
    setSeuil2("14");
    setSeuil3("30");
  };

  const parseValues = () => {
    const v1 = Number(seuil1);
    const v2 = Number(seuil2);
    const v3 = Number(seuil3);

    if (!Number.isFinite(v1) || !Number.isFinite(v2) || !Number.isFinite(v3)) {
      toast.error("Merci de saisir des nombres pour les seuils de relance.");
      return null;
    }

    if (v1 <= 0 || v2 <= 0 || v3 <= 0) {
      toast.error("Les seuils doivent être strictement positifs.");
      return null;
    }

    if (!(v1 < v2 && v2 < v3)) {
      toast.error("Les seuils doivent être croissants (seuil 1 < seuil 2 < seuil 3).");
      return null;
    }

    return { v1, v2, v3 };
  };

  /* ------------------------------- Submit ------------------------------- */

  const handleSave = async () => {
    const parsed = parseValues();
    if (!parsed) return;

    const { v1, v2, v3 } = parsed;

    setSaving(true);
    try {
      if (rowId) {
        // UPDATE de la dernière ligne
        const { error } = await supabase
          .from("agence_settings")
          .update({
            relance_seuil_1: v1,
            relance_seuil_2: v2,
            relance_seuil_3: v3,
          })
          .eq("id", rowId);

        if (error) {
          console.error(error);
          toast.error("Erreur lors de la mise à jour des réglages de relance");
          return;
        }

        toast.success("Réglages de relance mis à jour");
      } else {
        // INSERT si aucune config n'existe encore
        const { data, error } = await supabase
          .from("agence_settings")
          .insert({
            relance_seuil_1: v1,
            relance_seuil_2: v2,
            relance_seuil_3: v3,
          })
          .select("id")
          .single();

        if (error) {
          console.error(error);
          toast.error("Erreur lors de la création des réglages de relance");
          return;
        }

        setRowId(data.id);
        toast.success("Réglages de relance créés");
      }
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------- Render ------------------------------- */

  const disabled = loading || saving;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relances facturation</CardTitle>
        <CardDescription className="text-xs">
          Configure les seuils (en jours) pour les relances à partir de la date de signature
          d&apos;un contrat <span className="font-medium">signé sans paiement</span>.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Seuil 1 */}
          <div className="space-y-1">
            <Label htmlFor="relance-seuil-1" className="text-xs font-medium">
              Seuil 1
            </Label>
            <Input
              id="relance-seuil-1"
              type="number"
              min={1}
              step={1}
              className="h-8 text-xs"
              value={seuil1}
              onChange={(e) => setSeuil1(e.target.value)}
              disabled={disabled}
            />
            <p className="text-[11px] text-muted-foreground">
              Contrats signés entre J+0 et J+{seuil1 || "…"} sans paiement.
            </p>
          </div>

          {/* Seuil 2 */}
          <div className="space-y-1">
            <Label htmlFor="relance-seuil-2" className="text-xs font-medium">
              Seuil 2
            </Label>
            <Input
              id="relance-seuil-2"
              type="number"
              min={1}
              step={1}
              className="h-8 text-xs"
              value={seuil2}
              onChange={(e) => setSeuil2(e.target.value)}
              disabled={disabled}
            />
            <p className="text-[11px] text-muted-foreground">
              Contrats signés entre J+{Number(seuil1 || 0) + 1} et J+
              {seuil2 || "…"} sans paiement.
            </p>
          </div>

          {/* Seuil 3 */}
          <div className="space-y-1">
            <Label htmlFor="relance-seuil-3" className="text-xs font-medium">
              Seuil 3
            </Label>
            <Input
              id="relance-seuil-3"
              type="number"
              min={1}
              step={1}
              className="h-8 text-xs"
              value={seuil3}
              onChange={(e) => setSeuil3(e.target.value)}
              disabled={disabled}
            />
            <p className="text-[11px] text-muted-foreground">
              Contrats signés au-delà de J+{seuil3 || "…"} sans paiement.
            </p>
          </div>
        </div>

        {!loading && (
          <p className="text-[11px] text-muted-foreground">
            Ces seuils sont utilisés dans la vue <code>contrats_relance</code> pour
            calculer le niveau de relance (<code>relance_niveau</code> et{" "}
            <code>relance_label</code>).
          </p>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={resetDefaults}
          disabled={disabled}
        >
          Réinitialiser (7 / 14 / 30 j)
        </Button>

        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          onClick={handleSave}
          disabled={disabled}
        >
          {saving ? "Enregistrement..." : "Enregistrer les seuils"}
        </Button>
      </CardFooter>
    </Card>
  );
}