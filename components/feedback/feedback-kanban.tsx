// components/feedback/feedback-kanban.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  DndContext,
  useDroppable,
  useDraggable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  BugIcon,
  CheckCircle2Icon,
  HelpCircleIcon,
  LightbulbIcon,
  Loader2Icon,
  ThumbsDownIcon,
  Wand2Icon,
  ImageIcon,
  ClockIcon,
  EyeIcon,
  UserIcon,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type FeedbackStatus = "inbox" | "triage" | "in_progress" | "done" | "rejected";
type FeedbackType = "bug" | "feature_idea" | "improvement" | "other";
type Priority = "low" | "medium" | "high" | "urgent";

type FeedbackItem = {
  id: string;
  created_by: string | null;
  type: FeedbackType;
  title: string;
  description: string | null;
  status: FeedbackStatus;
  priority: Priority | null;
  screenshot_paths: string[] | null;
  created_at: string;
  updated_at: string | null;
};

type FeedbackKanbanProps = {
  className?: string;
};

const FEEDBACK_BUCKET = "feedback-screenshots";

const STATUS_COLUMNS: {
  id: FeedbackStatus;
  label: string;
  description: string;
}[] = [
  {
    id: "inbox",
    label: "Inbox",
    description: "Nouveaux retours utilisateurs à trier.",
  },
  {
    id: "in_progress",
    label: "En cours",
    description: "En cours de traitement.",
  },
  {
    id: "done",
    label: "Résolu",
    description: "Corrigé ou implémenté.",
  },
];

const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: "Bug",
  feature_idea: "Idée de feature",
  improvement: "Amélioration",
  other: "Autre",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Haute",
  urgent: "Urgente",
};

const PRIORITY_CLASSNAME: Partial<Record<Priority, string>> = {
  low: "bg-emerald-50 text-emerald-800 border-emerald-100",
  medium: "bg-sky-50 text-sky-800 border-sky-100",
  high: "bg-amber-50 text-amber-800 border-amber-100",
  urgent: "bg-rose-50 text-rose-800 border-rose-100",
};

function getTypeIcon(type: FeedbackType) {
  switch (type) {
    case "bug":
      return <BugIcon className="h-3.5 w-3.5" />;
    case "feature_idea":
      return <LightbulbIcon className="h-3.5 w-3.5" />;
    case "improvement":
      return <Wand2Icon className="h-3.5 w-3.5" />;
    default:
      return <HelpCircleIcon className="h-3.5 w-3.5" />;
  }
}

function getStatusIcon(status: FeedbackStatus) {
  switch (status) {
    case "inbox":
      return <HelpCircleIcon className="h-3 w-3" />;
    case "triage":
      return <ClockIcon className="h-3 w-3" />;
    case "in_progress":
      return <Loader2Icon className="h-3 w-3" />;
    case "done":
      return <CheckCircle2Icon className="h-3 w-3" />;
    case "rejected":
      return <ThumbsDownIcon className="h-3 w-3" />;
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                          Card “présentation pure”                          */
/* -------------------------------------------------------------------------- */

type FeedbackCardProps = {
  item: FeedbackItem;
  isMine: boolean;
  onOpen?: () => void;
  isDragging?: boolean;
};

function FeedbackCard({ item, isMine, onOpen, isDragging }: FeedbackCardProps) {
  const screenshotCount = item.screenshot_paths?.length ?? 0;

  const createdAt = new Date(item.created_at).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });

  const shortUserId =
    item.created_by && item.created_by.length > 8
      ? `${item.created_by.slice(0, 8)}…`
      : item.created_by ?? "Inconnu";

  return (
    <div
      className={cn(
        "group rounded-lg border bg-background p-2.5 text-xs shadow-sm transition-all",
        "cursor-pointer",
        isDragging && "opacity-80 ring-2 ring-primary/40 ring-offset-2"
      )}
    >
      <div className="flex flex-col gap-2">
        {/* Titre + priorité */}
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
              {getTypeIcon(item.type)}
            </div>
            <p className="line-clamp-2 text-[13px] font-medium">{item.title}</p>
          </div>

          {item.priority && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                PRIORITY_CLASSNAME[item.priority] ??
                  "bg-slate-50 text-slate-700 border-slate-100"
              )}
            >
              {PRIORITY_LABEL[item.priority]}
            </span>
          )}
        </div>

        {/* Description courte */}
        {item.description && (
          <p className="mb-1.5 line-clamp-2 text-[11px] text-muted-foreground">
            {item.description}
          </p>
        )}

        {/* Ligne user */}
        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <UserIcon className="h-3 w-3" />
            <span>{isMine ? "Moi" : shortUserId}</span>
          </div>
        </div>

        {/* Tags + date */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          {item.type && (
            <Badge
              variant="outline"
              className="gap-1 rounded-full px-1.5 py-0 text-[10px]"
            >
              {getTypeIcon(item.type)}
              <span>{TYPE_LABEL[item.type]}</span>
            </Badge>
          )}

          {screenshotCount > 0 && (
            <Badge
              variant="outline"
              className="gap-1 rounded-full px-1.5 py-0 text-[10px]"
            >
              <ImageIcon className="h-3 w-3" />
              <span>{screenshotCount}</span>
            </Badge>
          )}

          <span className="ml-auto text-[10px]">{createdAt}</span>
        </div>

        {/* Bouton détails */}
        {onOpen && (
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              (
                e as unknown as React.PointerEvent
              ).nativeEvent.stopImmediatePropagation?.();
              onOpen();
            }}
            onPointerDown={(e) => {
              // bloque le drag dnd-kit sur ce bouton
              e.stopPropagation();
            }}
          >
            <EyeIcon className="h-3 w-3" />
            <span>Détails</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Card draggable                                */
/* -------------------------------------------------------------------------- */

function DraggableFeedbackCard({
  item,
  onOpen,
  isMine,
}: {
  item: FeedbackItem;
  onOpen?: () => void;
  isMine: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <FeedbackCard
        item={item}
        isMine={isMine}
        onOpen={onOpen}
        isDragging={isDragging}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Droppable col.                               */
/* -------------------------------------------------------------------------- */

function FeedbackColumn({
  status,
  label,
  description,
  items,
  onOpenItem,
  currentUserId,
}: {
  status: FeedbackStatus;
  label: string;
  description: string;
  items: FeedbackItem[];
  onOpenItem: (item: FeedbackItem) => void;
  currentUserId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="gap-1 rounded-full px-1.5 py-0">
            {getStatusIcon(status)}
            <span className="text-[11px] font-medium">{label}</span>
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {items.length}
          </span>
        </div>
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">{description}</p>

      <div
        ref={setNodeRef}
        className={cn(
          "mt-1 flex min-h-[260px] flex-1 flex-col gap-2 rounded-xl border bg-muted/40 p-2 transition-colors",
          isOver && "border-primary/60 bg-primary/5"
        )}
      >
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[11px] text-muted-foreground">
            Glisse un feedback ici
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto">
            {items.map((item) => (
              <DraggableFeedbackCard
                key={item.id}
                item={item}
                isMine={item.created_by === currentUserId}
                onOpen={() => onOpenItem(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Main component                                */
/* -------------------------------------------------------------------------- */

export function FeedbackKanban({ className }: FeedbackKanbanProps) {
  const supabase = createClient();

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Pour DragOverlay
  const [activeId, setActiveId] = useState<string | null>(null);

  // Dialog détails
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Dialog de confirmation de suppression
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Récupérer user courant (pour afficher "Moi")
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    };
    void fetchUser();
  }, [supabase]);

  useEffect(() => {
    console.log("[FeedbackKanban] currentUserId =", currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    const fetchFeedback = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("feedback_items")
        .select(
          `
          id,
          created_by,
          type,
          title,
          description,
          status,
          priority,
          screenshot_paths,
          created_at,
          updated_at
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        toast.error("Erreur lors du chargement des feedbacks", {
          description: error.message,
        });
        setItems([]);
        setLoading(false);
        return;
      }

      setItems((data ?? []) as FeedbackItem[]);
      setLoading(false);
    };

    void fetchFeedback();
  }, [supabase]);

  const totalCount = items.length;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
  
    if (!over) return;
  
    const feedbackId = String(active.id);
    const newStatus = over.id as FeedbackStatus;
  
    // statut valide ?
    const isValidStatus = STATUS_COLUMNS.some((col) => col.id === newStatus);
    if (!isValidStatus) return;
  
    // 🔎 on regarde l'item AVANT de modifier le state
    const currentItem = items.find((i) => i.id === feedbackId);
    if (!currentItem) {
      console.warn("[FeedbackKanban] Feedback non trouvé :", feedbackId);
      return;
    }
  
    const previousStatus = currentItem.status;
  
    // si le statut est déjà le même, on ne fait rien
    if (previousStatus === newStatus) {
      console.log(
        "[FeedbackKanban] Statut identique, pas d'update Supabase",
        newStatus
      );
      return;
    }
  
    // ✅ optimistic update côté UI
    setItems((prev) =>
      prev.map((i) =>
        i.id === feedbackId ? { ...i, status: newStatus } : i
      )
    );
  
    setUpdatingId(feedbackId);
  
    const { error } = await supabase
      .from("feedback_items")
      .update({ status: newStatus })
      .eq("id", feedbackId);
  
    setUpdatingId(null);
  
    if (error) {
      console.error("[FeedbackKanban] Update status error", error);
      toast.error("Erreur lors de la mise à jour du statut", {
        description: error.message,
      });
  
      // ⏪ rollback du statut côté UI
      setItems((prev) =>
        prev.map((i) =>
          i.id === feedbackId ? { ...i, status: previousStatus } : i
        )
      );
  
      return;
    }
  
    const colLabel =
      STATUS_COLUMNS.find((c) => c.id === newStatus)?.label ?? newStatus;
  
    // 🎉 toast de confirmation
    toast.success("Statut mis à jour", {
      description: `Déplacé vers « ${colLabel} ».`,
    });
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const itemsByStatus: Record<FeedbackStatus, FeedbackItem[]> =
    STATUS_COLUMNS.reduce(
      (acc, col) => {
        acc[col.id] = items.filter((i) => i.status === col.id);
        return acc;
      },
      {
        inbox: [] as FeedbackItem[],
        triage: [] as FeedbackItem[],
        in_progress: [] as FeedbackItem[],
        done: [] as FeedbackItem[],
        rejected: [] as FeedbackItem[],
      }
    );

  const handleOpenItem = (item: FeedbackItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  // item actif pour DragOverlay
  const activeItem = activeId
    ? items.find((i) => i.id === activeId) ?? null
    : null;

  // URLs publiques pour les screenshots de l'item sélectionné
  const screenshotUrls =
    selectedItem?.screenshot_paths?.map((path) => {
      const { data } = supabase.storage
        .from(FEEDBACK_BUCKET)
        .getPublicUrl(path);
      return { path, url: data.publicUrl as string | null };
    }) ?? [];

  /* ------------------------ suppression avec dialog ------------------------ */

  const handleConfirmDelete = async () => {
    if (!selectedItem) return;
    const item = selectedItem;
    setDeleteLoading(true);

    try {
      // 1) supprimer la ligne en base
      const { error: deleteError } = await supabase
        .from("feedback_items")
        .delete()
        .eq("id", item.id);

      if (deleteError) {
        console.error(deleteError);
        toast.error("Erreur lors de la suppression du feedback", {
          description: deleteError.message,
        });
        return;
      }

      // 2) supprimer les captures associées (si présentes)
      const paths = (item.screenshot_paths ?? []) as string[];
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(FEEDBACK_BUCKET)
          .remove(paths);

        if (storageError) {
          console.error(storageError);
          toast.warning(
            "Feedback supprimé, mais certaines captures n'ont pas pu être supprimées."
          );
        }
      }

      // 3) maj du state local
      setItems((prev) => prev.filter((f) => f.id !== item.id));

      // 4) fermer le dialog
      setDetailOpen(false);
      setSelectedItem(null);

      // 5) toast de succès
      toast.success("Feedback supprimé", {
        description: "Le feedback et ses captures ont été supprimés.",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Card className={cn("h-full", className)}>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-medium">
                Feedback & bugs (Kanban)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Visualise et organise les retours utilisateurs par statut.
              </p>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold">
                {loading ? "…" : totalCount}
              </span>
              <span className="text-[11px] text-muted-foreground">
                feedback au total
              </span>
              {updatingId && (
                <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Loader2Icon className="h-3 w-3 animate-spin" />
                  Mise à jour…
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          {loading && items.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
              Chargement du kanban…
            </div>
          ) : (
            <DndContext
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {STATUS_COLUMNS.map((col) => (
                  <FeedbackColumn
                    key={col.id}
                    status={col.id}
                    label={col.label}
                    description={col.description}
                    items={itemsByStatus[col.id]}
                    onOpenItem={handleOpenItem}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>

              {/* DragOverlay : la carte reste visible même hors colonne */}
              <DragOverlay>
                {activeItem && (
                  <div className="pointer-events-none">
                    <FeedbackCard
                      item={activeItem}
                      isMine={activeItem.created_by === currentUserId}
                      isDragging
                    />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Dialog détails feedback */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                    {getTypeIcon(selectedItem.type)}
                  </span>
                  <span>{selectedItem.title}</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Créé le{" "}
                  {new Date(selectedItem.created_at).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1 rounded-full">
                    {getStatusIcon(selectedItem.status)}
                    <span className="text-[11px]">
                      {STATUS_COLUMNS.find((c) => c.id === selectedItem.status)
                        ?.label ?? selectedItem.status}
                    </span>
                  </Badge>

                  <Badge variant="outline" className="gap-1 rounded-full">
                    {getTypeIcon(selectedItem.type)}
                    <span className="text-[11px]">
                      {TYPE_LABEL[selectedItem.type]}
                    </span>
                  </Badge>

                  {selectedItem.priority && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 rounded-full",
                        PRIORITY_CLASSNAME[selectedItem.priority] ??
                          "bg-slate-50 text-slate-700 border-slate-100"
                      )}
                    >
                      <span className="text-[11px]">
                        {PRIORITY_LABEL[selectedItem.priority]}
                      </span>
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <UserIcon className="h-3.5 w-3.5" />
                  <span>
                    Créé par{" "}
                    {selectedItem.created_by === currentUserId
                      ? "toi"
                      : selectedItem.created_by ?? "utilisateur inconnu"}
                  </span>
                </div>

                {selectedItem.description && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium">Description</p>
                    <p className="whitespace-pre-wrap text-[11px]">
                      {selectedItem.description}
                    </p>
                  </div>
                )}

                {screenshotUrls.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium">
                      Captures d&apos;écran ({screenshotUrls.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {screenshotUrls.map(
                        ({ path, url }) =>
                          url && (
                            <a
                              key={path}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative block overflow-hidden rounded-md border bg-muted"
                            >
                              <Image
                                src={url}
                                alt="Capture du feedback"
                                width={400}
                                height={200}
                                className="h-28 w-full object-cover transition-transform group-hover:scale-105"
                              />
                            </a>
                          )
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-3 flex justify-between">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? "Suppression..." : "Supprimer"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDetailOpen(false)}
                >
                  Fermer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Supprimer ce feedback ?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cette action est définitive. Le feedback et ses captures
              d&apos;écran seront supprimés (si les policies de storage le
              permettent).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
