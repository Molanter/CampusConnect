// components/filters-bar.tsx

import type { Dispatch, SetStateAction } from "react";

import {
  BudgetFilter,
  DistanceFilter,
  Mood,
  TimeFilter,
  moodFilters,
} from "../lib/explore-types";

type FiltersBarProps = {
  activeMood: Mood | "Any";
  setActiveMood: Dispatch<SetStateAction<Mood | "Any">>;
  activeBudget: BudgetFilter;
  setActiveBudget: Dispatch<SetStateAction<BudgetFilter>>;
  activeTime: TimeFilter;
  setActiveTime: Dispatch<SetStateAction<TimeFilter>>;
  activeDistance: DistanceFilter;
  setActiveDistance: Dispatch<SetStateAction<DistanceFilter>>;
};

export function FiltersBar({
  activeMood,
  setActiveMood,
  activeBudget,
  setActiveBudget,
  activeTime,
  setActiveTime,
  activeDistance,
  setActiveDistance,
}: FiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-white/10 bg-slate-950/40 px-4 py-3 text-[11px]">
      <FilterGroup label="Mood">
        {moodFilters.map((m) => (
          <FilterChip
            key={m}
            label={m}
            active={m === activeMood}
            onClick={() =>
              setActiveMood((prev) => (prev === m ? "Any" : m))
            }
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Budget">
        <FilterChip
          label="Free"
          active={activeBudget === "Free"}
          onClick={() =>
            setActiveBudget((prev) => (prev === "Free" ? "Any" : "Free"))
          }
        />
        <FilterChip
          label="$"
          active={activeBudget === "$"}
          onClick={() =>
            setActiveBudget((prev) => (prev === "$" ? "Any" : "$"))
          }
        />
        <FilterChip
          label="$$"
          active={activeBudget === "$$"}
          onClick={() =>
            setActiveBudget((prev) => (prev === "$$" ? "Any" : "$$"))
          }
        />
        <FilterChip
          label="$$$"
          active={activeBudget === "$$$"}
          onClick={() =>
            setActiveBudget((prev) => (prev === "$$$" ? "Any" : "$$$"))
          }
        />
      </FilterGroup>

      <FilterGroup label="Time">
        <FilterChip
          label="Now"
          active={activeTime === "Now"}
          onClick={() =>
            setActiveTime((prev) => (prev === "Now" ? "Any" : "Now"))
          }
        />
        <FilterChip
          label="Next 2h"
          active={activeTime === "Next 2h"}
          onClick={() =>
            setActiveTime((prev) =>
              prev === "Next 2h" ? "Any" : "Next 2h"
            )
          }
        />
        <FilterChip
          label="Tonight"
          active={activeTime === "Tonight"}
          onClick={() =>
            setActiveTime((prev) =>
              prev === "Tonight" ? "Any" : "Tonight"
            )
          }
        />
      </FilterGroup>

      <FilterGroup label="Distance">
        <FilterChip
          label="Walkable"
          active={activeDistance === "Walkable"}
          onClick={() =>
            setActiveDistance((prev) =>
              prev === "Walkable" ? "Any" : "Walkable"
            )
          }
        />
        <FilterChip
          label="Short ride"
          active={activeDistance === "Short ride"}
          onClick={() =>
            setActiveDistance((prev) =>
              prev === "Short ride" ? "Any" : "Short ride"
            )
          }
        />
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  if (active) {
    return (
      <button
        className="rounded-full bg-brand px-3 py-1 text-[11px] font-medium text-white shadow-sm"
        type="button"
        onClick={onClick}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-slate-100 hover:border-white/40 hover:bg-white/10 transition"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}