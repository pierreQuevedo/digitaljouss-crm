// components/agenda/event-calendar.tsx
"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color?: string; // hex, ex: "#F97316"
};

const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: "1",
    title: "Call découverte – Acme",
    start: addDays(new Date(), 0),
    end: addDays(new Date(), 0),
    color: "#F97316",
  },
  {
    id: "2",
    title: "Envoi proposition – Studio Nova",
    start: addDays(new Date(), 2),
    end: addDays(new Date(), 2),
    color: "#3B82F6",
  },
  {
    id: "3",
    title: "Kickoff projet – Client X",
    start: addDays(new Date(), 7),
    end: addDays(new Date(), 7),
    color: "#22C55E",
  },
];

type ViewMode = "month" | "week";

export function EventCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // ------------------------------
  // Génération des jours affichés
  // ------------------------------
  const days = useMemo(() => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }

    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate, viewMode]);

  const weekDaysLabels = Array.from({ length: 7 }).map((_, index) =>
    format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), index), "EEE", {
      locale: fr,
    }),
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const event of MOCK_EVENTS) {
      const key = format(event.start, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }

    return map;
  }, []);

  const selectedKey = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : undefined;
  const selectedEvents = selectedKey ? eventsByDate.get(selectedKey) ?? [] : [];

  // ------------------------------
  // Navigation
  // ------------------------------
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const goPrev = () => {
    setCurrentDate((prev) =>
      viewMode === "month" ? addMonths(prev, -1) : addDays(prev, -7),
    );
  };

  const goNext = () => {
    setCurrentDate((prev) =>
      viewMode === "month" ? addMonths(prev, 1) : addDays(prev, 7),
    );
  };

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
      {/* Colonne gauche : résumé du jour / liste d’events */}
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <CardTitle className="text-sm font-medium">
                {selectedDate
                  ? format(selectedDate, "EEEE d MMMM", { locale: fr })
                  : "Agenda"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {selectedEvents.length === 0
                  ? "Aucun événement pour ce jour."
                  : `${selectedEvents.length} événement${
                      selectedEvents.length > 1 ? "s" : ""
                    } programmé${
                      selectedEvents.length > 1 ? "s" : ""
                    }.`}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {selectedEvents.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
              Utilise l’agenda pour visualiser tes rendez-vous, appels et
              envois de propositions.
            </div>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start gap-2 rounded-md border bg-background px-3 py-2 text-xs"
                >
                  <span
                    className="mt-1 h-2 w-2 rounded-full"
                    style={{ backgroundColor: event.color ?? "#F97316" }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{event.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {format(event.start, "HH:mm", { locale: fr })} –{" "}
                      {format(event.end, "HH:mm", { locale: fr })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Colonne droite : calendrier (Month / Week) */}
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={goPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={goNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Aujourd’hui
            </Button>

            <div className="ml-2 text-sm font-semibold">
              {format(currentDate, "MMMM yyyy", { locale: fr })}
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-md border bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "rounded-sm px-2 py-1",
                viewMode === "month" && "bg-background shadow-sm",
              )}
            >
              Mois
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "rounded-sm px-2 py-1",
                viewMode === "week" && "bg-background shadow-sm",
              )}
            >
              Semaine
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {/* En-têtes jours de la semaine */}
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
            {weekDaysLabels.map((label) => (
              <div key={label} className="py-1 uppercase">
                {label}
              </div>
            ))}
          </div>

          {/* Grille de jours */}
          <div className="grid grid-cols-7 gap-px rounded-md border bg-border text-xs">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDate.get(key) ?? [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const selected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "flex h-20 flex-col gap-1 border-b border-r bg-background p-1 text-left align-top transition hover:bg-muted/80",
                    !isCurrentMonth && "bg-muted/40 text-muted-foreground",
                    selected && "ring-1 ring-primary",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                        isToday(day) &&
                          "bg-primary text-primary-foreground font-semibold",
                      )}
                    >
                      {format(day, "d", { locale: fr })}
                    </span>
                  </div>

                  {/* Petites pastilles d’events */}
                  <div className="mt-1 flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="truncate rounded-sm px-1 py-0.5 text-[10px] text-white"
                        style={{
                          backgroundColor: event.color ?? "#F97316",
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        + {dayEvents.length - 3} autre(s)
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}