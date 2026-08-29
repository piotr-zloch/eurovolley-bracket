"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveStandingsPrediction } from "./actions";

type Team = { id: number; name: string };

function SortableTeamRow({ team, position }: { team: Team; position: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: team.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded border bg-white px-3 py-2 ${
        isDragging ? "z-10 border-blue-400 shadow-lg" : "border-transparent bg-gray-50"
      }`}
    >
      <span className="w-5 shrink-0 text-gray-400">{position}.</span>
      <span className="flex-1">{team.name}</span>
      {/* Drag listeners live on the handle only, so a touch drag on the rest of the row
          still scrolls the page instead of picking the item up. */}
      <button
        type="button"
        aria-label={`Reorder ${team.name}`}
        className="cursor-grab touch-none px-1 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
    </li>
  );
}

export default function GroupStandingsForm({
  tournamentId,
  groupId,
  groupName,
  teams,
  initiallySaved,
}: {
  tournamentId: number;
  groupId: number;
  groupName: string;
  teams: Team[];
  initiallySaved: boolean;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<Team[]>(teams);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(
    // Small distance threshold so a click/tap isn't mistaken for a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Short hold on touch keeps the list scrollable.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    // Keyboard: focus the handle, Space to lift, arrows to move, Space to drop.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrder((prev) => {
      const from = prev.findIndex((t) => t.id === active.id);
      const to = prev.findIndex((t) => t.id === over.id);
      return arrayMove(prev, from, to);
    });
    setDirty(true);
    setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    try {
      await saveStandingsPrediction(
        tournamentId,
        groupId,
        order.map((t, i) => ({ teamId: t.id, position: i + 1 }))
      );
      setStatus("saved");
      setDirty(false);
      // Re-render the server component so the "x of 4 saved" progress and the
      // bracket call-to-action reflect this save without a manual reload.
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  const isSaved = (initiallySaved || status === "saved") && !dirty;

  return (
    <div className="rounded border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{groupName}</h2>
        {isSaved && <span className="text-xs text-green-600">✓ saved</span>}
      </div>

      {/* Explicit id: without one, dnd-kit derives its aria-describedby ids from an
          auto-incrementing counter that differs between the server and client renders,
          which trips a React hydration mismatch. */}
      <DndContext
        id={`group-standings-${groupId}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={order.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ol className="mb-3 flex flex-col gap-1">
            {order.map((t, i) => (
              <SortableTeamRow key={t.id} team={t} position={i + 1} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <button onClick={handleSave} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
        {status === "saving" ? "Saving…" : isSaved ? "Save again" : "Save prediction"}
      </button>
      {status === "error" && <span className="ml-2 text-sm text-red-600">Error saving.</span>}
    </div>
  );
}
