import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import {
  Chip,
  Disclosure,
  Eyebrow,
  KZ,
  List,
  Mono,
  SectionTitle,
  Square,
  Tag,
  pad2,
} from "@/components/kz";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import type { GlossaryCategory } from "@/lib/va-glossary";
import { seedFor } from "@/lib/program-seed";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/stakeholders")({
  head: ({ params }) => ({
    meta: [{ title: pageTitle("Stakeholders & Glossary", PROGRAMS[params.programId]) }],
  }),
  component: Stakeholders,
});

/**
 * Who and what.
 *
 * Both halves on one page rather than behind a tab pair: the roster and the
 * glossary are each a reference you arrive at knowing which one you want, and a
 * tab strip made you click to find out the other existed. Org cards tile at
 * 320px, glossary categories at 380px, and adjacent cards collapse their
 * borders into one hairline grid.
 */
function Stakeholders() {
  const program = useProgram();
  const seed = seedFor(program.id);

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Who and what"
        title="Stakeholders & Glossary"
        subtitle={`The roster across ${seed.orgs.length} organizations, plus the acronym glossary for reading the program notes.`}
      />

      <div style={{ padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
            gap: 0,
          }}
        >
          {seed.orgs.map((org) => (
            <section
              key={org.name}
              style={{ border: `1px solid ${KZ.bone}`, margin: -0.5, padding: "20px 24px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderBottom: `1px solid ${KZ.bone}`,
                  paddingBottom: 10,
                }}
              >
                <Square tone={org.color} filled size={8} />
                <SectionTitle size={16}>{org.name}</SectionTitle>
                <Mono size={11} style={{ marginLeft: "auto" }}>
                  {pad2(org.contacts.length)}
                </Mono>
              </div>
              <List>
                {org.contacts.map((c) => (
                  <li
                    key={c.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      padding: "9px 0",
                      borderBottom: `1px solid ${KZ.grey200}`,
                    }}
                  >
                    <span style={{ fontSize: 13.5 }}>{c.name}</span>
                    <Mono size={10.5} style={{ textAlign: "right" }}>
                      {[c.role, c.ws].filter(Boolean).join(" · ")}
                    </Mono>
                  </li>
                ))}
              </List>
            </section>
          ))}
        </div>

        <GlossarySection />
      </div>
    </AppLayout>
  );
}

function GlossarySection() {
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
  }, [seed, q, activeCat]);

  const grouped = useMemo(() => {
    const map = new Map<GlossaryCategory, typeof seed.glossary>();
    for (const e of filtered) {
      const arr = map.get(e.category) ?? [];
      arr.push(e);
      map.set(e.category, arr);
    }
    return map;
  }, [seed, filtered]);

  if (seed.glossary.length === 0) return null;

  return (
    <div style={{ marginTop: 44 }}>
      <Eyebrow size={11}>Acronym glossary</Eyebrow>
      {/* A program without a glossary source has none to cite; crediting one
          program's Notion page for another's glossary would be a fabrication. */}
      <div style={{ marginTop: 6 }}>
        {seed.glossarySource ? (
          <Mono size={10.5}>
            Sourced from Notion ·{" "}
            <a href={seed.glossarySource.url} target="_blank" rel="noreferrer">
              {seed.glossarySource.title}
            </a>{" "}
            · updated {seed.glossarySource.updated}
          </Mono>
        ) : (
          <Mono size={10.5}>No source is recorded for this glossary</Mono>
        )}
      </div>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search acronym or meaning…"
          className="kz-input"
          style={{ width: 280, padding: "8px 12px", fontSize: 12.5 }}
        />
        <Chip
          label={`All · ${pad2(seed.glossary.length)}`}
          active={activeCat === "all"}
          onClick={() => setActiveCat("all")}
        />
        {seed.glossaryCategories.map((c) => (
          <Chip
            key={c.key}
            label={c.key}
            active={activeCat === c.key}
            onClick={() => setActiveCat(c.key)}
            title={c.blurb}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            marginTop: 18,
            border: `1px solid ${KZ.grey400}`,
            padding: 40,
            textAlign: "center",
            fontSize: 13.5,
            color: KZ.body,
          }}
        >
          No matches for “{q}”.
        </div>
      ) : (
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(380px,1fr))",
            gap: 0,
          }}
        >
          {seed.glossaryCategories
            .filter((c) => grouped.has(c.key))
            .map((c) => {
              const entries = grouped.get(c.key)!;
              return (
                <section
                  key={c.key}
                  style={{ border: `1px solid ${KZ.bone}`, margin: -0.5, padding: "20px 24px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 12,
                      borderBottom: `1px solid ${KZ.bone}`,
                      paddingBottom: 10,
                    }}
                  >
                    <Mono size={11} tone={KZ.ink} style={{ textTransform: "uppercase" }}>
                      {c.key}
                    </Mono>
                    <Mono size={11}>{pad2(entries.length)}</Mono>
                  </div>
                  <List>
                    {entries.map((e) => (
                      <li
                        key={`${e.category}-${e.term}`}
                        style={{
                          display: "flex",
                          gap: 14,
                          padding: "9px 0",
                          borderBottom: `1px solid ${KZ.grey200}`,
                        }}
                      >
                        <Mono size={11} tone={KZ.ink} style={{ width: 64, flex: "0 0 64px" }}>
                          {e.term}
                        </Mono>
                        <span style={{ fontSize: 13, lineHeight: 1.45, color: KZ.body }}>
                          {e.meaning.replace(/\s*\(unconfirmed\)\s*/i, " ").trim()}
                          {e.lead ? <span style={{ color: KZ.ink }}> · {e.lead}</span> : null}
                          {/* "Unconfirmed" is the glossary's own honesty
                              marker: a term nobody has verified reads
                              differently from one that is settled. */}
                          {e.unconfirmed ? (
                            <Tag tone={KZ.amber} style={{ marginLeft: 8 }}>
                              unconfirmed
                            </Tag>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </List>
                </section>
              );
            })}
        </div>
      )}
      <Disclosure style={{ marginTop: 14 }}>
        {pad2(filtered.length)} of {pad2(seed.glossary.length)} terms shown · unconfirmed entries
        are the ones nobody has verified against a source
      </Disclosure>
    </div>
  );
}
