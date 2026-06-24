-- ============================================================================
-- Legal documents customization (KupaPay).
-- Operator: sarussilberg (sole proprietor, Israel).
-- Effective date: 2026-06-02 (Internal Testing first submission to Google Play).
--
-- Prerequisites: cost-share-app/supabase/seed-legal-documents.sql has already
-- been run against this project.
--
-- Idempotent: safe to re-run on both dev and prod environments.
-- Apply via Supabase Studio (SQL Editor).
-- ============================================================================

BEGIN;

-- English copies (terms + privacy):
-- 1. Replace any legacy "[Partnership Name]" placeholder with sarussilberg.
-- 2. Remove any residual private names and replace with sarussilberg.
-- 3. Normalise the entity-type clause to a simple "operating from Israel".
-- 4. Stamp the effective date.
UPDATE public.legal_documents SET
    content_md =
        replace(
            replace(
                replace(
                    replace(
                        replace(
                            content_md,
                            '[Partnership Name]', 'sarussilberg'
                        ),
                        'a partnership organized under the laws of the State of Israel',
                        'operating from Israel'
                    ),
                    'an individual operating from Israel under the trade name "Sarussilberg"',
                    'operating from Israel'
                ),
                'Nave Sarussi',
                'sarussilberg'
            ),
            '{{EFFECTIVE_DATE}}', 'June 2, 2026'
        ),
    effective_date = '2026-06-02'
WHERE locale = 'en' AND is_published = true;

-- Hebrew copies (terms + privacy):
UPDATE public.legal_documents SET
    content_md =
        replace(
            replace(
                replace(
                    replace(
                        replace(
                            content_md,
                            '[Partnership Name]', 'sarussilberg'
                        ),
                        'שותפות הפועלת לפי חוקי מדינת ישראל',
                        'עוסק יחיד הפועל מישראל'
                    ),
                    'עוסק יחיד הפועל מישראל תחת שם המסחר "Sarussilberg"',
                    'עוסק יחיד הפועל מישראל'
                ),
                'נוה סרוסי',
                'sarussilberg'
            ),
            '{{EFFECTIVE_DATE}}', '2 ביוני 2026'
        ),
    effective_date = '2026-06-02'
WHERE locale = 'he' AND is_published = true;

COMMIT;

-- Verify — expect 4 rows, all placeholder/name columns false.
SELECT
    slug,
    locale,
    version,
    is_published,
    effective_date,
    content_md NOT LIKE '%[Partnership Name]%'                    AS no_placeholder,
    content_md NOT LIKE '%{{EFFECTIVE_DATE}}%'                    AS no_date_placeholder,
    content_md NOT LIKE '%Nave Sarussi%'                          AS no_private_name_en,
    content_md NOT LIKE '%נוה סרוסי%'                             AS no_private_name_he,
    content_md NOT LIKE '%partnership organized%'                  AS no_partnership_clause_en,
    content_md NOT LIKE '%שותפות הפועלת%'                         AS no_partnership_clause_he,
    content_md NOT LIKE '%trade name "Sarussilberg"%'             AS no_tradename_clause
FROM public.legal_documents
WHERE is_published = true
ORDER BY slug, locale;
