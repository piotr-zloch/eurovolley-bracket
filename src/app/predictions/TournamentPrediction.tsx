"use client";

import { useMemo, useState } from "react";
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
import { QF_SOURCES, ROUND_OF_16_TEMPLATE, SF_SOURCES } from "@/lib/knockout-template";
import { fmt, type Dict } from "@/lib/i18n";
import { saveAllPredictions } from "./actions";

type Team = { id: number; name: string };
type Group = { id: number; name: string; code: string; teams: Team[] };
type Slot = { slot: string; home: Team | null; away: Team | null };

/**
 * Left-to-right order for the bracket display, chosen so each match sits directly above the two
 * that feed it. CEV's numbering isn't sequential across the bracket (QF1 takes EF1 and EF4, and
 * the semifinals cross QF1xQF4 / QF2xQF3), so drawing the slots in numeric order would put every
 * quarterfinal above the wrong pair — a picture that quietly states the wrong thing.
 */
const DISPLAY_ORDER: Record<string, string[]> = {
  r16: ["EF1", "EF4", "EF6", "EF7", "EF2", "EF3", "EF5", "EF8"],
  qf: ["QF1", "QF4", "QF2", "QF3"],
  sf: ["SF1", "SF2"],
};

function inDisplayOrder(slots: Slot[], order: string[]): Slot[] {
  return [...slots].sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
}

function SortableTeamRow({
  teamId,
  name,
  position,
}: {
  teamId: number;
  name: string;
  position: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: teamId,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded border px-3 py-2 ${
        isDragging ? "z-10 border-blue-400 bg-white shadow-lg" : "border-transparent bg-gray-50"
      }`}
    >
      <span className="w-5 shrink-0 text-gray-400">{position}.</span>
      <span className="flex-1">{name}</span>
      {/* Listeners on the handle only, so a touch drag elsewhere still scrolls the page. */}
      <button
        type="button"
        aria-label={name}
        className="cursor-grab touch-none px-1 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
    </li>
  );
}

export default function TournamentPrediction({
  tournamentId,
  groups,
  initialOrders,
  initialPicks,
  dict,
}: {
  tournamentId: number;
  groups: Group[];
  initialOrders: Record<number, number[]>;
  initialPicks: Record<string, number>;
  dict: Dict;
}) {
  const t = dict.predictions;

  const [orders, setOrders] = useState<Record<number, Team[]>>(() => {
    const initial: Record<number, Team[]> = {};
    groups.forEach((g) => {
      const savedIds = initialOrders[g.id];
      initial[g.id] = savedIds
        ? [...g.teams].sort((a, b) => savedIds.indexOf(a.id) - savedIds.indexOf(b.id))
        : g.teams;
    });
    return initial;
  });
  const [picks, setPicks] = useState<Record<string, number>>(initialPicks);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Names are read from the current props rather than from state on every render: switching
  // language re-renders the server component with translated names, but useState initialisers
  // don't re-run, so state still holds the team objects captured at mount. Looking the name up
  // by id keeps the language switch live without discarding unsaved picks.
  const nameById = useMemo(() => {
    const map = new Map<number, string>();
    groups.forEach((g) => g.teams.forEach((t) => map.set(t.id, t.name)));
    return map;
  }, [groups]);

  const label = (team: Team | null) => (team ? nameById.get(team.id) ?? team.name : "");

  const groupByCode = useMemo(() => {
    const map = new Map<string, Group>();
    groups.forEach((g) => map.set(g.code, g));
    return map;
  }, [groups]);

  /** Team currently sitting at `position` in group `code`, per the live (unsaved) order. */
  function teamAt(code: string, position: number): Team | null {
    const group = groupByCode.get(code);
    if (!group) return null;
    return orders[group.id]?.[position - 1] ?? null;
  }

  // The bracket is derived fresh on every render from the current group order, so dragging a
  // team updates the whole knockout tree immediately — no save required to see the effect.
  const { rounds, missingGroups, validPicks } = useMemo(() => {
    const missing = new Set<string>();
    const valid: Record<string, number> = {};

    const round16: Slot[] = ROUND_OF_16_TEMPLATE.map(({ slot, home, away }) => {
      const h = teamAt(home[0], home[1]);
      const a = teamAt(away[0], away[1]);
      if (!h) missing.add(home[0]);
      if (!a) missing.add(away[0]);
      return { slot, home: h, away: a };
    });

    // A pick only survives if the team is still one of the two contesting that slot; otherwise
    // reordering a group would leave a stale winner that no longer appears in the match.
    function resolve(slot: Slot): Team | null {
      const picked = picks[slot.slot];
      if (!picked) return null;
      const match = [slot.home, slot.away].find((t) => t?.id === picked);
      if (!match) return null;
      valid[slot.slot] = picked;
      return match;
    }

    /** The side that didn't win — only known once both teams and the winner are settled. */
    function loserOf(slot: Slot): Team | null {
      const winner = valid[slot.slot];
      if (!winner || !slot.home || !slot.away) return null;
      return slot.home.id === winner ? slot.away : slot.home;
    }

    const r16Winners: Record<string, Team | null> = {};
    round16.forEach((s) => (r16Winners[s.slot] = resolve(s)));

    const quarters: Slot[] = QF_SOURCES.map(([slot, a, b]) => ({
      slot,
      home: r16Winners[a] ?? null,
      away: r16Winners[b] ?? null,
    }));
    const qfWinners: Record<string, Team | null> = {};
    quarters.forEach((s) => (qfWinners[s.slot] = resolve(s)));

    const semis: Slot[] = SF_SOURCES.map(([slot, a, b]) => ({
      slot,
      home: qfWinners[a] ?? null,
      away: qfWinners[b] ?? null,
    }));
    const sfWinners: Record<string, Team | null> = {};
    semis.forEach((s) => (sfWinners[s.slot] = resolve(s)));

    const finalSlot: Slot = { slot: "FINAL", home: sfWinners["SF1"] ?? null, away: sfWinners["SF2"] ?? null };
    resolve(finalSlot);

    const bronzeSlot: Slot = {
      slot: "BRONZE",
      home: loserOf(semis[0]),
      away: loserOf(semis[1]),
    };
    resolve(bronzeSlot);

    return {
      rounds: [
        { title: t.roundOf16, slots: inDisplayOrder(round16, DISPLAY_ORDER.r16) },
        { title: t.quarterfinals, slots: inDisplayOrder(quarters, DISPLAY_ORDER.qf) },
        { title: t.semifinals, slots: inDisplayOrder(semis, DISPLAY_ORDER.sf) },
        { title: t.finalRow, slots: [finalSlot, bronzeSlot] },
      ],
      missingGroups: [...missing].sort(),
      validPicks: valid,
    };
  }, [orders, picks, groupByCode, t]);

  function handleDragEnd(groupId: number, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrders((prev) => {
      const list = prev[groupId];
      const from = list.findIndex((x) => x.id === active.id);
      const to = list.findIndex((x) => x.id === over.id);
      return { ...prev, [groupId]: arrayMove(list, from, to) };
    });
    setDirty(true);
    setStatus("idle");
  }

  function pick(slot: string, teamId: number) {
    setPicks((prev) => ({ ...prev, [slot]: teamId }));
    setDirty(true);
    setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    try {
      await saveAllPredictions(
        tournamentId,
        groups.map((g) => ({ groupId: g.id, teamIds: orders[g.id].map((x) => x.id) })),
        Object.entries(validPicks).map(([bracket_slot, predicted_winner_team_id]) => ({
          bracket_slot,
          predicted_winner_team_id,
        }))
      );
      setStatus("saved");
      setDirty(false);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-lg font-semibold">{t.groupStage}</h2>
        <p className="mb-4 text-sm text-gray-500">{t.groupStageHint}</p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className="rounded border p-4">
              <h3 className="mb-3 font-medium">{g.name}</h3>
              {/* Explicit id: dnd-kit's auto-incrementing aria ids differ between the server
                  and client render, which trips a hydration mismatch without one. */}
              <DndContext
                id={`group-${g.id}`}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd(g.id, e)}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              >
                <SortableContext
                  items={orders[g.id].map((x) => x.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ol className="flex flex-col gap-1">
                    {orders[g.id].map((team, i) => (
                      <SortableTeamRow
                        key={team.id}
                        teamId={team.id}
                        name={label(team)}
                        position={i + 1}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t.knockout}</h2>
        <p className="mb-4 text-sm text-gray-500">{t.knockoutHint}</p>

        {missingGroups.length > 0 && (
          <p className="mb-4 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
            {fmt(t.knockoutIncomplete, {
              groups: missingGroups.map((c) => fmt(dict.groupLabel, { code: c })).join(", "),
            })}
          </p>
        )}

        {/* Rounds read top-to-bottom, each on a single row. Every row is divided into the same
            number of equal cells as the round of 16 has matches, and each card is centred in its
            share — so a quarterfinal sits over the two matches that feed it, like a real bracket.
            The track is wider than the page on purpose and scrolls sideways on narrow screens. */}
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-[1000px] flex-col gap-6">
            {rounds.map((round) => (
              <div key={round.title}>
                <h3 className="mb-2 font-medium">{round.title}</h3>
                <div className="flex gap-2">
                  {round.slots.map((s) => {
                    const chosen = validPicks[s.slot];
                    return (
                      <div key={s.slot} className="flex flex-1 justify-center">
                        <div className="flex w-[118px] flex-col gap-1 rounded border p-2 text-sm">
                          <span className="text-xs text-gray-400">{s.slot}</span>
                          {[s.home, s.away].map((team, side) =>
                            team ? (
                              <button
                                key={side}
                                onClick={() => pick(s.slot, team.id)}
                                className={`truncate rounded px-2 py-1 text-left ${
                                  chosen === team.id
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 hover:bg-gray-200"
                                }`}
                                title={label(team)}
                              >
                                {label(team)}
                              </button>
                            ) : (
                              <span key={side} className="rounded bg-gray-50 px-2 py-1 text-gray-300">
                                {t.tbd}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 flex items-center gap-3 border-t bg-white/95 py-4 backdrop-blur">
        <button
          onClick={handleSave}
          className="rounded bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-60"
          disabled={status === "saving"}
        >
          {status === "saving" ? t.saving : t.save}
        </button>
        {status === "saved" && <span className="text-sm text-green-600">{t.saved}</span>}
        {status === "error" && <span className="text-sm text-red-600">{t.saveError}</span>}
        {dirty && status !== "saving" && (
          <span className="text-sm text-gray-500">{t.unsaved}</span>
        )}
      </div>
    </div>
  );
}
