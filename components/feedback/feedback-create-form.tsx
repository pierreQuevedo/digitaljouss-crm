// components/feedback/feedback-create-form.tsx
"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { MultiFilesUpload } from "@/components/ui/upload/multi-files-upload";

type FeedbackStatus = "inbox" | "triage" | "in_progress" | "done" | "rejected";
type FeedbackType = "bug" | "feature_idea" | "improvement" | "other";
// ⚠️ aligné avec ton enum SQL feedback_priority
type Priority = "low" | "medium" | "high" | "urgent";

type FeedbackCreateFormProps = {
  className?: string;
  // pour dire au parent de refetch le kanban par ex.
  onCreated?: () => void;
};

const FEEDBACK_BUCKET = "feedback-screenshots";

export function FeedbackCreateForm({
  className,
  onCreated,
}: FeedbackCreateFormProps) {
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<FeedbackType>("bug");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // ✅ fonction stable → évite la boucle infinie avec MultiFilesUpload
  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Titre requis", {
        description: "Merci d'indiquer un titre pour le feedback.",
      });
      return;
    }

    try {
      setSubmitting(true);

      // 🔐 1) Récupérer l'utilisateur courant
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(userError);
        toast.error("Non connecté", {
          description: "Tu dois être connecté pour envoyer un feedback.",
        });
        return;
      }

      // 2) Création du feedback (sans screenshots pour l’instant)
      const { data: inserted, error: insertError } = await supabase
        .from("feedback_items")
        .insert({
          type,
          title: trimmedTitle,
          description: description.trim() || null,
          status: "inbox" as FeedbackStatus,
          priority,
          created_by: user.id, // 👈 IMPORTANT pour passer la policy RLS
          // screenshot_paths sera rempli juste après
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        console.error(insertError);
        toast.error("Erreur lors de la création du feedback", {
          description: insertError?.message,
        });
        return;
      }

      const feedbackId = inserted.id as string;

      // 2) Upload des screenshots si besoin
      let uploadedPaths: string[] = [];

      if (files.length > 0) {
        const uploadResults = await Promise.all(
          files.map(async (file, index) => {
            const ext = file.name.split(".").pop() || "png";
            const fileNameSafe = file.name
              .toLowerCase()
              .replace(/[^a-z0-9.-]/g, "-");

            const path = `feedback/${feedbackId}/${Date.now()}-${index}-${fileNameSafe}.${ext}`;

            const { error: uploadError } = await supabase.storage
              .from(FEEDBACK_BUCKET)
              .upload(path, file, {
                upsert: false,
              });

            if (uploadError) {
              console.error(uploadError);
              return { ok: false as const, path, error: uploadError };
            }

            return { ok: true as const, path };
          })
        );

        const failed = uploadResults.filter((r) => !r.ok);
        const success = uploadResults.filter(
          (r): r is { ok: true; path: string } => r.ok
        );

        if (failed.length > 0) {
          toast.warning("Certaines captures n'ont pas pu être envoyées", {
            description: `${failed.length} fichier(s) en erreur.`,
          });
        }

        uploadedPaths = success.map((r) => r.path);
      }

      // 3) Mise à jour du feedback avec les paths des screenshots
      if (uploadedPaths.length > 0) {
        const { error: updateError } = await supabase
          .from("feedback_items")
          .update({
            screenshot_paths: uploadedPaths,
          })
          .eq("id", feedbackId);

        if (updateError) {
          console.error(updateError);
          toast.warning("Feedback créé, mais problème avec les captures", {
            description:
              "Les captures ont été uploadées mais le lien avec le feedback n’a pas pu être enregistré.",
          });
        }
      }

      toast.success("Feedback envoyé", {
        description:
          type === "bug"
            ? "Merci pour le signalement du bug 🙏"
            : "Merci pour ton retour, il a bien été enregistré 🙌",
      });

      // reset formulaire
      setTitle("");
      setType("bug");
      setDescription("");
      setPriority("medium");
      setFiles([]);
      onCreated?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Ajouter un feedback
        </CardTitle>
        <CardDescription className="text-xs">
          Bug, idée de fonctionnalité ou amélioration – avec captures
          d&apos;écran si besoin.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Type + priorité */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="feedback_type">Nature</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as FeedbackType)}
              >
                <SelectTrigger id="feedback_type" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="feature_idea">Idée de feature</SelectItem>
                  <SelectItem value="improvement">Amélioration</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="feedback_priority">Priorité</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as Priority)}
              >
                <SelectTrigger id="feedback_priority" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Titre */}
          <div className="grid gap-1.5">
            <Label htmlFor="feedback_title">Titre *</Label>
            <Input
              id="feedback_title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Impossible d'enregistrer un contrat"
              required
            />
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="feedback_description">Description</Label>
            <Textarea
              id="feedback_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explique ce que tu faisais, ce que tu attendais, et ce qui s'est passé."
              rows={4}
            />
          </div>

          {/* Screenshots */}
          <div className="grid gap-1.5">
            <Label>Captures d&apos;écran</Label>
            <MultiFilesUpload
              label="Dépose tes captures ou clique pour les choisir"
              maxFiles={10}
              maxSize={50 * 1024 * 1024}
              onFilesChange={handleFilesChange}
            />
            <p className="text-[11px] text-muted-foreground">
              Ajoute autant de captures que nécessaire pour illustrer le bug ou
              la demande.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Envoi..." : "Envoyer le feedback"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
