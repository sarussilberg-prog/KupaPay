-- Strip the embedded "Effective date" / "Version" lines from published legal docs.
--
-- Why: the app version is now shown from a single source of truth
-- (packages/shared/version.json -> APP_VERSION) in the mobile legal sheet and the
-- web legal page, and the effective date is rendered from the
-- legal_documents.effective_date column. The two markdown lines inside content_md
-- duplicated that information and would drift on every release.
--
-- This rewrites content_md for the 4 currently-published rows (privacy/terms x
-- en/he), removing the two-line block that sits between the H1 title and the body.
-- The `version` column is intentionally kept (internal bookkeeping); it is simply
-- no longer displayed.
--
-- The content was edited directly in the live DB (not via a prior migration), so
-- this migration operates on the live rows on both dev and prod.
--
-- Forward-only and idempotent: regexp_replace is a no-op when the pattern is
-- already absent, so re-running this migration changes nothing.

-- English: "**Effective date:** ...\n**Version:** ...\n\n"
UPDATE public.legal_documents
SET content_md = regexp_replace(
        content_md,
        E'\\*\\*Effective date:\\*\\*[^\\n]*\\n\\*\\*Version:\\*\\*[^\\n]*\\n\\n',
        ''
    )
WHERE locale = 'en'
  AND slug IN ('privacy', 'terms');

-- Hebrew: "**תאריך כניסה לתוקף:** ...\n**גרסה:** ...\n\n"
UPDATE public.legal_documents
SET content_md = regexp_replace(
        content_md,
        E'\\*\\*תאריך כניסה לתוקף:\\*\\*[^\\n]*\\n\\*\\*גרסה:\\*\\*[^\\n]*\\n\\n',
        ''
    )
WHERE locale = 'he'
  AND slug IN ('privacy', 'terms');
