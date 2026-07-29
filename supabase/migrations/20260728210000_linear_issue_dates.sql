-- due_date and created_at on synced Linear issues.
--
-- Needed because one program derives its risk register from the board rather
-- than from a written document, and "overdue" is half the rule. Without these
-- columns that half silently never fires: the Ventura register would return 1
-- entry (the single Bug-labelled issue) instead of 7, and look complete.
--
-- They also fill two POA&M columns that the VA Notion table cannot supply at
-- all — Original Detection Date and Scheduled Completion Date.
--
-- Both nullable on purpose. Most Linear issues carry no due date, and a NULL
-- means "no commitment", which must not be coerced into one.

ALTER TABLE public.linear_issues
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS source_created_at TIMESTAMPTZ;

-- The register query filters on due_date < today across the whole table.
CREATE INDEX IF NOT EXISTS idx_linear_issues_due_date
  ON public.linear_issues (due_date)
  WHERE due_date IS NOT NULL;
