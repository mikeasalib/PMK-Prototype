-- Linear project milestones.
--
-- The milestone/gate layer is the backbone every generated artifact shares, and
-- until now its dates came from hand-maintained config. Linear already holds the
-- real ones with target dates and progress, and they disagree with config in two
-- places, so this makes Linear the source.
--
-- Mirrors the shape of the existing synced tables: source_id is the natural key
-- for upsert, synced_at records when we last read it so provenance can cite a
-- time, and reads are public to anon like the others.

CREATE TABLE public.linear_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  -- Linear allows a milestone with no target date; a NULL here is meaningful
  -- (undated) and must not be coerced to a date by the reader.
  target_date DATE,
  -- 0..1. Linear returns a fraction; the UI shows it as a percentage.
  progress NUMERIC,
  sort_order NUMERIC,
  url TEXT,
  source_created_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Artifacts read milestones in date order for the schedule section.
CREATE INDEX idx_linear_milestones_target_date ON public.linear_milestones (target_date);

ALTER TABLE public.linear_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read linear_milestones"
  ON public.linear_milestones FOR SELECT TO anon USING (true);
