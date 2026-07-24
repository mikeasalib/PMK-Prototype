
DROP POLICY IF EXISTS "Authenticated write linear_issues" ON public.linear_issues;
DROP POLICY IF EXISTS "Authenticated write notion_pages" ON public.notion_pages;
DROP POLICY IF EXISTS "Authenticated write granola_notes" ON public.granola_notes;
DROP POLICY IF EXISTS "Authenticated write sync_runs" ON public.sync_runs;

REVOKE INSERT, UPDATE, DELETE ON public.linear_issues FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.notion_pages FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.granola_notes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sync_runs FROM authenticated;

GRANT SELECT ON public.linear_issues TO anon;
GRANT SELECT ON public.notion_pages TO anon;
GRANT SELECT ON public.granola_notes TO anon;
GRANT SELECT ON public.sync_runs TO anon;

CREATE POLICY "Public read linear_issues" ON public.linear_issues FOR SELECT TO anon USING (true);
CREATE POLICY "Public read notion_pages" ON public.notion_pages FOR SELECT TO anon USING (true);
CREATE POLICY "Public read granola_notes" ON public.granola_notes FOR SELECT TO anon USING (true);
CREATE POLICY "Public read sync_runs" ON public.sync_runs FOR SELECT TO anon USING (true);
