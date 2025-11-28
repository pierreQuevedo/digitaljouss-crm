// app/dashboard/agenda/page.tsx
"use client";

import { useState } from "react";
import { addHours } from "date-fns";

// ✅ Importer directement depuis le dossier généré par comp-542
// import {
//   EventCalendar,
//   type CalendarEvent,
// } from "@/components/event-calendar";

// const initialEvents: CalendarEvent[] = [
//   {
//     id: "1",
//     title: "Kick-off projet",
//     description: "Réunion de lancement avec le client",
//     start: new Date(),
//     end: addHours(new Date(), 1),
//     allDay: false,
//     color: "orange", // "orange" | "sky" | "amber" | "violet" | "rose" | "emerald"
//     location: "Visio",
//   },
// ];

export default function AgendaPage() {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);

  const handleEventAdd = (event: CalendarEvent) => {
    setEvents((prev) => [...prev, event]);
  };

  const handleEventUpdate = (updated: CalendarEvent) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e)),
    );
  };

  const handleEventDelete = (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  return (
    <main className="flex flex-1 flex-col p-4">
      <h1 className="mb-4 text-xl font-semibold">Agenda</h1>
      <div className="rounded-xl border bg-card">
        <EventCalendar
          events={events}
          onEventAdd={handleEventAdd}
          onEventUpdate={handleEventUpdate}
          onEventDelete={handleEventDelete}
          initialView="month" // "month" | "week" | "day" | "agenda"
          className="h-[calc(100vh-7rem)]"
        />
      </div>
    </main>
  );
}