// components/feedback/feedback-page-content.tsx
"use client";

import { useState } from "react";
import { FeedbackCreateForm } from "@/components/feedback/feedback-create-form";
import { FeedbackKanban } from "@/components/feedback/feedback-kanban";

export function FeedbackPageContent() {
  const [refreshKey, setRefreshKey] = useState<number>(0);

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <FeedbackCreateForm
          onCreated={() => setRefreshKey((k: number) => k + 1)}
        />
        <FeedbackKanban key={refreshKey} />
      </div>
    </div>
  );
}