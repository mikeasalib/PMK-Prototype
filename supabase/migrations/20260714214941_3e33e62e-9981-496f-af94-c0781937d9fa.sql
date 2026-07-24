
CREATE TABLE public.linear_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  identifier TEXT NOT NULL,
  title TEXT NOT NULL,
  state_name TEXT,
  state_type TEXT,
  priority INT,
  assignee TEXT,
  workstream TEXT,
  cycle_number INT,
  cycle_name TEXT,
  labels TEXT[] DEFAULT '{}',
  url TEXT,
  source_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linear_issues TO authenticated;
GRANT ALL ON public.linear_issues TO service_role;
ALTER TABLE public.linear_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read linear_issues" ON public.linear_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write linear_issues" ON public.linear_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.notion_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  url TEXT,
  parent_type TEXT,
  parent_id TEXT,
  source_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notion_pages TO authenticated;
GRANT ALL ON public.notion_pages TO service_role;
ALTER TABLE public.notion_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read notion_pages" ON public.notion_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write notion_pages" ON public.notion_pages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.granola_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  url TEXT,
  source_created_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.granola_notes TO authenticated;
GRANT ALL ON public.granola_notes TO service_role;
ALTER TABLE public.granola_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read granola_notes" ON public.granola_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write granola_notes" ON public.granola_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.sync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  count INT,
  scope TEXT,
  message TEXT,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read sync_runs" ON public.sync_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write sync_runs" ON public.sync_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_linear_issues_updated_at BEFORE UPDATE ON public.linear_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notion_pages_updated_at BEFORE UPDATE ON public.notion_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_granola_notes_updated_at BEFORE UPDATE ON public.granola_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_linear_issues_workstream ON public.linear_issues(workstream);
CREATE INDEX idx_linear_issues_state ON public.linear_issues(state_type);
CREATE INDEX idx_sync_runs_source_ran ON public.sync_runs(source, ran_at DESC);
