import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";

import { PROGRAMS, pageTitle } from "@/lib/program.config";
import type { GlossaryCategory } from "@/lib/va-glossary";
import { seedFor } from "@/lib/program-seed";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/stakeholders")({
  head: ({ params }) => ({
    meta: [{ title: pageTitle("Stakeholders & glossary", PROGRAMS[params.programId]) }],
  }),
  component: Stakeholders,
});

type Tab = "people" | "glossary";

function Stakeholders() {
  const program = useProgram();
  const seed = seedFor(program.id);
  const [tab, setTab] = useState<Tab>("people");

  return (
    <AppLayout>
      <PageHeader
        title="Stakeholders & glossary"
        subtitle="Who's who across VA and GovCIO, and what the acronyms mean when they show up in notes."
      />

      <div className="px-4 pt-4 sm:px-6">
        <div
          className="inline-flex rounded-md text-[12px] font-medium"
          style={{ border: "1px solid #d5d5d0", backgroundColor: "#fff" }}
        >
          {(
            [
              { k: "people", label: "People" },
              { k: "glossary", label: "Glossary" },
            ] as const
          ).map((t, i) => {
            const active = tab === t.k;
            return (
              <button
                key={t.k}
                type="button"
                onClick={() => setTab(t.k)}
                className="px-3 py-1.5 transition-colors"
                style={{
                  backgroundColor: active ? "#2e5d3a" : "transparent",
                  color: active ? "#fff" : "#333",
                  borderLeft: i === 0 ? "none" : "1px solid #d5d5d0",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "people" ? <PeoplePanel /> : <GlossaryPanel />}
    </AppLayout>
  );
}

function PeoplePanel() {
  const program = useProgram();
  const seed = seedFor(program.id);
  return (
    <div className="grid grid-cols-1 gap-4 p-6 xl:grid-cols-2 2xl:grid-cols-4">
      {seed.orgs.map((org) => (
        <section
          key={org.name}
          className="rounded-md"
          style={{ border: "1px solid #e5e5e2", backgroundColor: "#fff" }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{
              backgroundColor: `${org.color}14`,
              borderBottom: `1px solid ${org.color}44`,
            }}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: org.color }}
            />
            <h2 className="text-[13px] font-semibold" style={{ color: org.color }}>
              {org.name}
            </h2>
            <span className="ml-auto text-[11px]" style={{ color: "#666" }}>
              {org.contacts.length} contacts
            </span>
          </div>
          <ul className="divide-y" style={{ borderColor: "#eee" }}>
            {org.contacts.map((c) => (
              <li key={c.name} className="flex items-start justify-between gap-2 px-3 py-2">
                <div>
                  <div className="text-[13px] font-medium">{c.name}</div>
                  <div className="text-[11px]" style={{ color: "#666" }}>
                    {c.role}
                  </div>
                </div>
                {c.ws ? (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: "#f0eef7",
                      color: "#4a3fb5",
                      border: "1px solid #4a3fb544",
                    }}
                  >
                    {c.ws}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function GlossaryPanel() {
  const program = useProgram();
  const seed = seedFor(program.id);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<GlossaryCategory | "all">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return seed.glossary.filter((e) => {
      if (activeCat !== "all" && e.category !== activeCat) return false;
      if (!needle) return true;
      return (
        e.term.toLowerCase().includes(needle) ||
        e.meaning.toLowerCase().includes(needle) ||
        (e.lead ?? "").toLowerCase().includes(needle)
      );
    });
  }, [q, activeCat]);

  const grouped = useMemo(() => {
    const map = new Map<GlossaryCategory, typeof seed.glossary>();
    for (const e of filtered) {
      const arr = map.get(e.category) ?? [];
      arr.push(e);
      map.set(e.category, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search acronym or meaning…"
          className="w-64 rounded-md px-2.5 py-1.5 text-[12px] outline-none focus:ring-2"
          style={{
            border: "1px solid #d5d5d0",
            backgroundColor: "#fff",
          }}
        />
        <button
          type="button"
          onClick={() => setActiveCat("all")}
          className="rounded px-2 py-1 text-[11px] font-medium"
          style={{
            border: "1px solid #d5d5d0",
            backgroundColor: activeCat === "all" ? "#2e5d3a" : "#fff",
            color: activeCat === "all" ? "#fff" : "#333",
          }}
        >
          All ({seed.glossary.length})
        </button>
        {seed.glossaryCategories.map((c) => {
          const count = seed.glossary.filter((e) => e.category === c.key).length;
          const active = activeCat === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveCat(c.key)}
              className="rounded px-2 py-1 text-[11px] font-medium"
              style={{
                border: `1px solid ${c.color}55`,
                backgroundColor: active ? c.color : `${c.color}12`,
                color: active ? "#fff" : c.color,
              }}
            >
              {c.key} ({count})
            </button>
          );
        })}
        {/* A program without a glossary has no source to cite. Rendering the
            attribution unconditionally would credit VA's Notion page for an
            empty glossary. */}
        {seed.glossarySource ? (
          <span className="ml-auto text-[11px]" style={{ color: "#666" }}>
            Source:{" "}
            <a
              href={seed.glossarySource.url}
              target="_blank"
              rel="noreferrer"
              className="underline"
              style={{ color: "#2e5d3a" }}
            >
              {seed.glossarySource.title}
            </a>{" "}
            · {seed.glossarySource.updated}
          </span>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-md p-6 text-center text-[13px]"
          style={{
            border: "1px dashed #d5d5d0",
            backgroundColor: "#fff",
            color: "#666",
          }}
        >
          No matches for "{q}".
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {seed.glossaryCategories
            .filter((c) => grouped.has(c.key))
            .map((c) => {
              const entries = grouped.get(c.key)!;
              return (
                <section
                  key={c.key}
                  className="rounded-md"
                  style={{
                    border: "1px solid #e5e5e2",
                    backgroundColor: "#fff",
                  }}
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{
                      backgroundColor: `${c.color}14`,
                      borderBottom: `1px solid ${c.color}44`,
                    }}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <h2 className="text-[13px] font-semibold" style={{ color: c.color }}>
                      {c.key}
                    </h2>
                    <span className="ml-auto text-[11px]" style={{ color: "#666" }}>
                      {entries.length}
                    </span>
                  </div>
                  <p className="px-3 pb-1.5 pt-1.5 text-[11px]" style={{ color: "#666" }}>
                    {c.blurb}
                  </p>
                  <ul className="divide-y" style={{ borderColor: "#eee" }}>
                    {entries.map((e) => (
                      <li key={`${e.category}-${e.term}`} className="px-3 py-2">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span
                            className="rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold"
                            style={{
                              backgroundColor: `${c.color}14`,
                              color: c.color,
                              border: `1px solid ${c.color}33`,
                            }}
                          >
                            {e.term}
                          </span>
                          {e.lead ? (
                            <span className="text-[11px]" style={{ color: "#333" }}>
                              Lead: <span style={{ fontWeight: 600 }}>{e.lead}</span>
                            </span>
                          ) : null}
                          {e.unconfirmed ? (
                            <span
                              className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                              style={{
                                backgroundColor: "#fff4e0",
                                color: "#8a5a00",
                                border: "1px solid #8a5a0044",
                              }}
                            >
                              unconfirmed
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[12px] leading-snug" style={{ color: "#333" }}>
                          {e.meaning.replace(/\s*\(unconfirmed\)\s*/i, " ").trim()}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
