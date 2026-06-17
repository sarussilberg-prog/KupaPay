-- Cost-Share App schema (Supabase)
-- Paste into Supabase SQL Editor. Mobile app uses anon key + user JWT (RLS enforced).

-- ============================================
-- CLEAN SLATE (dev convenience, comment out for prod)
-- ============================================
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS expense_splits CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100),
    email VARCHAR(255),
    avatar_url TEXT,
    phone VARCHAR(20),
    default_currency VARCHAR(3) DEFAULT 'ILS',
    language VARCHAR(5) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    note TEXT,
    image_url TEXT,
    group_type VARCHAR(50) DEFAULT 'general',
    default_currency VARCHAR(3) DEFAULT 'ILS',
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_groups_created_by ON groups(created_by);
CREATE INDEX idx_groups_is_active ON groups(is_active);

CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(group_id, user_id)
);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_active ON group_members(group_id, is_active);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'ILS',
    category VARCHAR(50),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_url TEXT,
    paid_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    split_mode TEXT NOT NULL DEFAULT 'equal'
        CHECK (split_mode IN ('equal', 'percent', 'amount')),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_expenses_group ON expenses(group_id);
CREATE INDEX idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_active ON expenses(group_id, is_deleted);

CREATE TABLE expense_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(expense_id, user_id)
);
CREATE INDEX idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user ON expense_splits(user_id);

CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'ILS',
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50),
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CHECK (from_user_id != to_user_id)
);
CREATE INDEX idx_settlements_group ON settlements(group_id);
CREATE INDEX idx_settlements_from_user ON settlements(from_user_id);
CREATE INDEX idx_settlements_to_user ON settlements(to_user_id);
CREATE INDEX idx_settlements_date ON settlements(settlement_date);
CREATE INDEX idx_settlements_active ON settlements(group_id) WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settlements_updated_at BEFORE UPDATE ON settlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;

-- handle_new_user runs only via the on_auth_user_created trigger; block RPC exposure.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- RLS helpers (SECURITY DEFINER — avoids infinite recursion on group_members)
-- ============================================

CREATE OR REPLACE FUNCTION public.is_group_member(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.group_members
        WHERE group_id = check_group_id
          AND user_id = auth.uid()
          AND is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_creator(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.groups
        WHERE id = check_group_id
          AND created_by = auth.uid()
    );
$$;

-- anon needs EXECUTE so RLS policies can evaluate (returns false when auth.uid() is null).
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_group_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_creator(uuid) TO anon, authenticated;

-- ============================================
-- ROW LEVEL SECURITY (mobile + web clients)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view their groups" ON groups
    FOR SELECT USING (public.is_group_member(id));
CREATE POLICY "Users can create groups" ON groups
    FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Group members can update their groups" ON groups
    FOR UPDATE USING (public.is_group_member(id));

CREATE POLICY "Users can view group members" ON group_members
    FOR SELECT USING (
        user_id = auth.uid() OR public.is_group_member(group_id)
    );
CREATE POLICY "Users can insert group members" ON group_members
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        OR public.is_group_creator(group_id)
        OR public.is_group_member(group_id)
    );
CREATE POLICY "Users can update group members" ON group_members
    FOR UPDATE USING (public.is_group_member(group_id));

CREATE POLICY "Users can view group expenses" ON expenses
    FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "Users can create expenses in their groups" ON expenses
    FOR INSERT WITH CHECK (public.is_group_member(group_id));
CREATE POLICY "Users can update group expenses" ON expenses
    FOR UPDATE USING (public.is_group_member(group_id));

CREATE POLICY "Users can view expense splits in their groups" ON expense_splits
    FOR SELECT USING (
        expense_id IN (
            SELECT e.id FROM expenses e
            WHERE public.is_group_member(e.group_id)
        )
    );
CREATE POLICY "Users can insert expense splits" ON expense_splits
    FOR INSERT WITH CHECK (
        expense_id IN (
            SELECT e.id FROM expenses e
            WHERE public.is_group_member(e.group_id)
        )
    );
CREATE POLICY "Users can delete expense splits" ON expense_splits
    FOR DELETE USING (
        expense_id IN (
            SELECT e.id FROM expenses e
            WHERE public.is_group_member(e.group_id)
        )
    );

CREATE POLICY "Users can view settlements in their groups" ON settlements
    FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "Users can create settlements in their groups" ON settlements
    FOR INSERT WITH CHECK (public.is_group_member(group_id));
CREATE POLICY "Group members can update settlements" ON settlements
    FOR UPDATE USING (public.is_group_member(group_id));
CREATE POLICY "Either party can delete settlement" ON settlements
    FOR DELETE USING (
        public.is_group_member(group_id)
        AND (auth.uid() = from_user_id OR auth.uid() = to_user_id)
    );


-- ============================================
-- SIMPLIFIED-INPUTS RPC (canonical source for every balance UI)
-- Returns per (group, currency, user) nets; the TS model in
-- @cost-share/shared/calculations/simplifiedDebtsModel runs simplifyDebts
-- per (group, currency) and derives every UI surface from one struct.
-- ============================================

CREATE OR REPLACE FUNCTION get_user_simplified_inputs(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_groups JSONB;
BEGIN
    WITH user_groups AS (
        SELECT gm.group_id
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id = p_user_id
          AND gm.is_active = TRUE
          AND g.is_active = TRUE
    ),
    group_members_active AS (
        SELECT gm.group_id, gm.user_id
        FROM group_members gm
        WHERE gm.group_id IN (SELECT group_id FROM user_groups)
          AND gm.is_active = TRUE
    ),
    paid AS (
        SELECT e.group_id, e.paid_by AS user_id, e.currency, SUM(e.amount) AS amount
        FROM expenses e
        WHERE e.group_id IN (SELECT group_id FROM user_groups)
          AND e.is_deleted = FALSE
        GROUP BY e.group_id, e.paid_by, e.currency
    ),
    owed AS (
        SELECT e.group_id, es.user_id, e.currency, SUM(es.amount) AS amount
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.group_id IN (SELECT group_id FROM user_groups)
          AND e.is_deleted = FALSE
        GROUP BY e.group_id, es.user_id, e.currency
    ),
    settled_paid AS (
        SELECT s.group_id, s.from_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id IN (SELECT group_id FROM user_groups)
          AND s.deleted_at IS NULL
        GROUP BY s.group_id, s.from_user_id, s.currency
    ),
    settled_received AS (
        SELECT s.group_id, s.to_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id IN (SELECT group_id FROM user_groups)
          AND s.deleted_at IS NULL
        GROUP BY s.group_id, s.to_user_id, s.currency
    ),
    activity AS (
        SELECT group_id, currency FROM paid
        UNION SELECT group_id, currency FROM owed
        UNION SELECT group_id, currency FROM settled_paid
        UNION SELECT group_id, currency FROM settled_received
    ),
    per_group_currency_user AS (
        SELECT
            a.group_id,
            a.currency,
            gma.user_id,
            ROUND((
                COALESCE(p.amount, 0)
              - COALESCE(o.amount, 0)
              + COALESCE(sp.amount, 0)
              - COALESCE(sr.amount, 0)
            )::numeric, 2) AS net
        FROM activity a
        JOIN group_members_active gma ON gma.group_id = a.group_id
        LEFT JOIN paid p
            ON p.group_id = a.group_id AND p.currency = a.currency AND p.user_id = gma.user_id
        LEFT JOIN owed o
            ON o.group_id = a.group_id AND o.currency = a.currency AND o.user_id = gma.user_id
        LEFT JOIN settled_paid sp
            ON sp.group_id = a.group_id AND sp.currency = a.currency AND sp.user_id = gma.user_id
        LEFT JOIN settled_received sr
            ON sr.group_id = a.group_id AND sr.currency = a.currency AND sr.user_id = gma.user_id
    ),
    nonzero_currencies AS (
        SELECT group_id, currency
        FROM per_group_currency_user
        GROUP BY group_id, currency
        HAVING MAX(ABS(net)) >= 0.01
    ),
    nets_by_currency AS (
        SELECT
            pcgu.group_id,
            pcgu.currency,
            jsonb_agg(
                jsonb_build_object('userId', pcgu.user_id, 'net', pcgu.net)
                ORDER BY pcgu.user_id
            ) AS nets
        FROM per_group_currency_user pcgu
        JOIN nonzero_currencies nc
            ON nc.group_id = pcgu.group_id AND nc.currency = pcgu.currency
        GROUP BY pcgu.group_id, pcgu.currency
    ),
    currencies_per_group AS (
        SELECT
            n.group_id,
            jsonb_agg(
                jsonb_build_object('currency', n.currency, 'nets', n.nets)
                ORDER BY n.currency
            ) AS currencies
        FROM nets_by_currency n
        GROUP BY n.group_id
    ),
    members_per_group AS (
        SELECT
            gma.group_id,
            jsonb_agg(
                jsonb_build_object(
                    'userId', gma.user_id,
                    'name', p.name,
                    'avatarUrl', p.avatar_url
                )
                ORDER BY p.name
            ) AS members
        FROM group_members_active gma
        JOIN profiles p ON p.id = gma.user_id
        GROUP BY gma.group_id
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'groupId', ug.group_id,
                'members', COALESCE(m.members, '[]'::jsonb),
                'currencies', COALESCE(c.currencies, '[]'::jsonb)
            )
            ORDER BY ug.group_id
        ),
        '[]'::jsonb
    )
    INTO v_groups
    FROM user_groups ug
    LEFT JOIN members_per_group m ON m.group_id = ug.group_id
    LEFT JOIN currencies_per_group c ON c.group_id = ug.group_id
    WHERE c.currencies IS NOT NULL;

    RETURN jsonb_build_object('groups', COALESCE(v_groups, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_simplified_inputs(UUID) TO authenticated;

-- ============================================

-- ============================================
-- ACCOUNT DEACTIVATION (soft delete) — base columns
-- (kept from v1 — v2 block below replaces the v1 RPC)
-- ============================================

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_is_active
    ON profiles(is_active) WHERE is_active = FALSE;

-- ============================================
-- ACCOUNT DELETION v2 — GDPR-compliant flow
-- Mirrors cost-share-app/supabase/account-deletion-v2.sql.
-- Keep these in sync.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- NEW TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS deleted_account_emails (
    email_hash TEXT PRIMARY KEY,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE deleted_account_emails ENABLE ROW LEVEL SECURITY;
-- No policies → only SECURITY DEFINER functions and service role can access.

CREATE TABLE IF NOT EXISTS account_deletions_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    email_hash TEXT NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL DEFAULT 'self_service',
    open_balance_snapshot JSONB,
    restored_at TIMESTAMPTZ,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_account_deletions_audit_user
    ON account_deletions_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletions_audit_deleted_at
    ON account_deletions_audit(deleted_at DESC);
ALTER TABLE account_deletions_audit ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS storage_cleanup_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_path TEXT NOT NULL,
    bucket TEXT NOT NULL DEFAULT 'profile-images',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error TEXT,
    UNIQUE (bucket, object_path)
);
CREATE INDEX IF NOT EXISTS idx_storage_cleanup_queue_pending
    ON storage_cleanup_queue(requested_at)
    WHERE processed_at IS NULL;
ALTER TABLE storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

-- ============================================
-- profiles: allow NULL name (display layer falls back to t('common.deletedUser'))
-- ============================================
ALTER TABLE profiles ALTER COLUMN name DROP NOT NULL;

-- ============================================
-- is_caller_active() — used by write RLS policies
-- Fail-open on missing row to preserve the first-login race behaviour that
-- existing assertProfileActive() relies on in lib/auth.ts.
-- ============================================
CREATE OR REPLACE FUNCTION public.is_caller_active() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    -- Returns TRUE only for an authenticated, active user.
    -- - Returns FALSE for anon (unauthenticated) callers.
    -- - Returns TRUE when the caller is authenticated but the profile row is
    --   missing — preserves the first-login race tolerated by assertProfileActive().
    SELECT CASE
        WHEN auth.uid() IS NULL THEN FALSE
        ELSE COALESCE((SELECT is_active FROM profiles WHERE id = auth.uid()), TRUE)
    END;
$$;
REVOKE EXECUTE ON FUNCTION public.is_caller_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_caller_active() TO anon, authenticated;

-- ============================================
-- delete_my_account() — full transactional flow
-- Replaces the v1 stub. Anonymizes PII, hashes the email for re-signup
-- block, snapshots open balances into the audit row, bans auth.users
-- via banned_until, and queues the avatar for async storage cleanup.
-- ============================================
CREATE OR REPLACE FUNCTION delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id  UUID := auth.uid();
    v_email    TEXT;
    v_avatar   TEXT;
    v_hash     TEXT;
    v_balance  JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    IF v_email IS NULL THEN
        RAISE EXCEPTION 'auth_user_missing';
    END IF;
    v_hash := encode(extensions.digest(lower(trim(v_email)), 'sha256'), 'hex');

    BEGIN
        v_balance := public.get_user_simplified_inputs(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        v_balance := jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE);
    END;

    SELECT avatar_url INTO v_avatar FROM profiles WHERE id = v_user_id;

    INSERT INTO deleted_account_emails (email_hash)
        VALUES (v_hash)
        ON CONFLICT (email_hash) DO NOTHING;

    UPDATE profiles
        SET name = NULL,
            email = NULL,
            avatar_url = NULL,
            phone = NULL,
            is_active = FALSE,
            deleted_at = NOW(),
            updated_at = NOW()
        WHERE id = v_user_id
          AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_already_inactive';
    END IF;

    UPDATE auth.users
        SET banned_until = 'infinity'::timestamptz
        WHERE id = v_user_id;

    INSERT INTO account_deletions_audit (user_id, email_hash, reason, open_balance_snapshot)
        VALUES (v_user_id, v_hash, 'self_service', v_balance);

    IF v_avatar IS NOT NULL THEN
        INSERT INTO storage_cleanup_queue (object_path)
            VALUES (v_avatar)
            ON CONFLICT (bucket, object_path) DO NOTHING;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;

-- ============================================
-- check_email_not_deleted() — BEFORE INSERT ON auth.users
-- Defense-in-depth: even if the app skips its own check, this rejects
-- re-signups for emails whose hash is in deleted_account_emails.
-- ============================================
CREATE OR REPLACE FUNCTION public.check_email_not_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hash TEXT;
BEGIN
    IF NEW.email IS NULL THEN
        RETURN NEW;
    END IF;
    v_hash := encode(extensions.digest(lower(trim(NEW.email)), 'sha256'), 'hex');
    IF EXISTS (SELECT 1 FROM deleted_account_emails WHERE email_hash = v_hash) THEN
        RAISE EXCEPTION 'email_was_deleted' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_deleted_email_signup ON auth.users;
CREATE TRIGGER block_deleted_email_signup
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.check_email_not_deleted();

-- ============================================
-- get_my_open_balances() — pre-deletion warning data
-- Derives a per-currency {currency, owed, owe, net} summary from the
-- canonical get_user_simplified_inputs RPC. Sign convention matches the
-- legacy shape so the existing mobile consumer doesn't change.
-- ============================================
CREATE OR REPLACE FUNCTION get_my_open_balances()
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_payload JSONB;
    v_summary JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('summary', '[]'::jsonb);
    END IF;

    v_payload := public.get_user_simplified_inputs(v_user_id);

    WITH per_currency_net AS (
        SELECT
            c->>'currency' AS currency,
            ROUND(((n->>'net')::numeric), 2) AS net
        FROM jsonb_array_elements(v_payload->'groups') g,
             jsonb_array_elements(g->'currencies') c,
             jsonb_array_elements(c->'nets') n
        WHERE n->>'userId' = v_user_id::text
    ),
    rolled AS (
        SELECT
            currency,
            ROUND(SUM(CASE WHEN net > 0 THEN net ELSE 0 END)::numeric, 2) AS owed,
            ROUND(SUM(CASE WHEN net < 0 THEN -net ELSE 0 END)::numeric, 2) AS owe
        FROM per_currency_net
        GROUP BY currency
        HAVING SUM(CASE WHEN net > 0 THEN net ELSE 0 END) >= 0.01
            OR SUM(CASE WHEN net < 0 THEN -net ELSE 0 END) >= 0.01
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'currency', currency,
                'owed', owed,
                'owe', owe,
                'net', ROUND((owed - owe)::numeric, 2)
            )
            ORDER BY currency
        ),
        '[]'::jsonb
    )
    INTO v_summary
    FROM rolled;

    RETURN jsonb_build_object('summary', COALESCE(v_summary, '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION get_my_open_balances() TO authenticated;

-- ============================================
-- RLS HARDENING: gate every write on is_caller_active()
-- Policy names match those above so DROP+CREATE replaces them.
-- ============================================

-- profiles
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id AND public.is_caller_active())
    WITH CHECK (auth.uid() = id AND public.is_caller_active());

-- groups
DROP POLICY IF EXISTS "Users can create groups" ON groups;
CREATE POLICY "Users can create groups" ON groups
    FOR INSERT
    WITH CHECK (auth.uid() = created_by AND public.is_caller_active());

DROP POLICY IF EXISTS "Group members can update their groups" ON groups;
CREATE POLICY "Group members can update their groups" ON groups
    FOR UPDATE
    USING (public.is_group_member(id) AND public.is_caller_active());

-- group_members
DROP POLICY IF EXISTS "Users can insert group members" ON group_members;
CREATE POLICY "Users can insert group members" ON group_members
    FOR INSERT
    WITH CHECK (
        public.is_caller_active()
        AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_id AND p.is_active = TRUE)
        AND (
            auth.uid() = user_id
            OR public.is_group_creator(group_id)
            OR public.is_group_member(group_id)
        )
    );

DROP POLICY IF EXISTS "Users can update group members" ON group_members;
CREATE POLICY "Users can update group members" ON group_members
    FOR UPDATE
    USING (public.is_group_member(group_id) AND public.is_caller_active());

-- expenses
DROP POLICY IF EXISTS "Users can create expenses in their groups" ON expenses;
CREATE POLICY "Users can create expenses in their groups" ON expenses
    FOR INSERT
    WITH CHECK (public.is_group_member(group_id) AND public.is_caller_active());

DROP POLICY IF EXISTS "Users can update group expenses" ON expenses;
CREATE POLICY "Users can update group expenses" ON expenses
    FOR UPDATE
    USING (public.is_group_member(group_id) AND public.is_caller_active());

-- expense_splits
DROP POLICY IF EXISTS "Users can insert expense splits" ON expense_splits;
CREATE POLICY "Users can insert expense splits" ON expense_splits
    FOR INSERT
    WITH CHECK (
        public.is_caller_active()
        AND expense_id IN (
            SELECT e.id FROM expenses e WHERE public.is_group_member(e.group_id)
        )
    );

DROP POLICY IF EXISTS "Users can delete expense splits" ON expense_splits;
CREATE POLICY "Users can delete expense splits" ON expense_splits
    FOR DELETE
    USING (
        public.is_caller_active()
        AND expense_id IN (
            SELECT e.id FROM expenses e WHERE public.is_group_member(e.group_id)
        )
    );

-- settlements
DROP POLICY IF EXISTS "Users can create settlements in their groups" ON settlements;
CREATE POLICY "Users can create settlements in their groups" ON settlements
    FOR INSERT
    WITH CHECK (public.is_group_member(group_id) AND public.is_caller_active());

DROP POLICY IF EXISTS "Group members can update settlements" ON settlements;
CREATE POLICY "Group members can update settlements" ON settlements
    FOR UPDATE
    USING (public.is_group_member(group_id) AND public.is_caller_active());

DROP POLICY IF EXISTS "Either party can delete settlement" ON settlements;
CREATE POLICY "Either party can delete settlement" ON settlements
    FOR DELETE
    USING (
        public.is_caller_active()
        AND public.is_group_member(group_id)
        AND (auth.uid() = from_user_id OR auth.uid() = to_user_id)
    );

-- ============================================
-- ACCOUNT RESTORATION (support-only) — mirrors account-deletion-v3-fixes.sql
-- ============================================
CREATE OR REPLACE FUNCTION restore_deleted_account(
    p_user_id UUID,
    p_restored_name TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_email     TEXT;
    v_meta_name TEXT;
    v_hash      TEXT;
BEGIN
    SELECT email, raw_user_meta_data->>'full_name'
    INTO v_email, v_meta_name
    FROM auth.users
    WHERE id = p_user_id;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'auth_user_not_found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = p_user_id AND is_active = FALSE
    ) THEN
        RAISE EXCEPTION 'profile_not_deleted';
    END IF;

    v_hash := encode(extensions.digest(lower(trim(v_email)), 'sha256'), 'hex');

    DELETE FROM deleted_account_emails WHERE email_hash = v_hash;

    UPDATE auth.users
        SET banned_until = NULL
        WHERE id = p_user_id;

    UPDATE profiles
        SET is_active = TRUE,
            deleted_at = NULL,
            email = v_email,
            name = COALESCE(
                NULLIF(trim(p_restored_name), ''),
                NULLIF(trim(v_meta_name), ''),
                split_part(v_email, '@', 1)
            ),
            updated_at = NOW()
        WHERE id = p_user_id;

    UPDATE account_deletions_audit
        SET restored_at = NOW(),
            notes = COALESCE(p_notes, notes)
        WHERE id = (
            SELECT id
            FROM account_deletions_audit
            WHERE user_id = p_user_id
              AND restored_at IS NULL
            ORDER BY deleted_at DESC
            LIMIT 1
        );
END;
$$;

REVOKE ALL ON FUNCTION restore_deleted_account(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restore_deleted_account(UUID, TEXT, TEXT) TO service_role;

-- ============================================
-- ACCOUNT RESTORATION (support-only) — mirrors account-deletion-v3-fixes.sql
-- ============================================
CREATE OR REPLACE FUNCTION restore_deleted_account(
    p_user_id UUID,
    p_restored_name TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_email     TEXT;
    v_meta_name TEXT;
    v_hash      TEXT;
BEGIN
    SELECT email, raw_user_meta_data->>'full_name'
    INTO v_email, v_meta_name
    FROM auth.users
    WHERE id = p_user_id;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'auth_user_not_found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = p_user_id AND is_active = FALSE
    ) THEN
        RAISE EXCEPTION 'profile_not_deleted';
    END IF;

    v_hash := encode(extensions.digest(lower(trim(v_email)), 'sha256'), 'hex');

    DELETE FROM deleted_account_emails WHERE email_hash = v_hash;

    UPDATE auth.users
        SET banned_until = NULL
        WHERE id = p_user_id;

    UPDATE profiles
        SET is_active = TRUE,
            deleted_at = NULL,
            email = v_email,
            name = COALESCE(
                NULLIF(trim(p_restored_name), ''),
                NULLIF(trim(v_meta_name), ''),
                split_part(v_email, '@', 1)
            ),
            updated_at = NOW()
        WHERE id = p_user_id;

    UPDATE account_deletions_audit
        SET restored_at = NOW(),
            notes = COALESCE(p_notes, notes)
        WHERE id = (
            SELECT id
            FROM account_deletions_audit
            WHERE user_id = p_user_id
              AND restored_at IS NULL
            ORDER BY deleted_at DESC
            LIMIT 1
        );
END;
$$;

REVOKE ALL ON FUNCTION restore_deleted_account(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restore_deleted_account(UUID, TEXT, TEXT) TO service_role;

-- ============================================
-- ADMIN PORTAL v1 (also lives in migrations/20260602100000_admin_portal_v1.sql)
-- ============================================
-- 20260602100000_admin_portal_v1.sql
-- Admin portal v1: app_admins table + is_app_admin() helper + 2 admin RPCs.
-- Idempotent. Safe to re-run.
--
-- Why a dedicated table (not a column on profiles):
--   profiles has permissive RLS (own-row UPDATE, public SELECT). Adding
--   is_admin there would let users self-promote and let anyone enumerate
--   admins. A dedicated table with no RLS policies is reachable only by
--   service_role and SECURITY DEFINER functions.

-- ============================================
-- app_admins
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_admins (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
-- No RLS policies on purpose: only service_role and SECURITY DEFINER funcs reach it.

-- ============================================
-- Seed: bootstrap the single app admin
-- ============================================
INSERT INTO public.app_admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'sarussilberg@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- is_app_admin() — used by every admin RPC and by the mobile client
-- ============================================
CREATE OR REPLACE FUNCTION public.is_app_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT CASE
        WHEN auth.uid() IS NULL THEN FALSE
        ELSE EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid())
    END;
$$;
REVOKE EXECUTE ON FUNCTION public.is_app_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- ============================================
-- admin_list_deleted_accounts()
-- Latest audit row per user where restored_at IS NULL, with the original email
-- pulled from auth.users (profiles.email is scrubbed on delete).
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_list_deleted_accounts()
RETURNS TABLE (
    user_id               UUID,
    email                 TEXT,
    deleted_at            TIMESTAMPTZ,
    reason                TEXT,
    open_balance_snapshot JSONB,
    notes                 TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH latest AS (
        SELECT DISTINCT ON (a.user_id)
            a.user_id, a.deleted_at, a.reason, a.open_balance_snapshot, a.notes, a.restored_at
        FROM public.account_deletions_audit a
        ORDER BY a.user_id, a.deleted_at DESC
    )
    SELECT
        l.user_id,
        u.email::TEXT,
        l.deleted_at,
        l.reason,
        l.open_balance_snapshot,
        l.notes
    FROM latest l
    JOIN auth.users u ON u.id = l.user_id
    WHERE l.restored_at IS NULL
    ORDER BY l.deleted_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_deleted_accounts() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_list_deleted_accounts() TO authenticated;

-- ============================================
-- admin_restore_deleted_account(p_user_id UUID)
-- Thin wrapper around the existing restore_deleted_account, stamping
-- 'restored_by_admin:<auth.uid()>' into the audit notes.
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_restore_deleted_account(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_admin UUID := auth.uid();
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    PERFORM public.restore_deleted_account(
        p_user_id,
        NULL,
        'restored_by_admin:' || v_admin::text
    );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_restore_deleted_account(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_restore_deleted_account(UUID) TO authenticated;

-- ============================================
-- group_is_auto_archived(UUID)
-- Shared predicate: group inactive 2+ months AND every active member
-- has net balance < 0.01 in every currency.
-- SECURITY DEFINER, not granted to authenticated — called only by other
-- SECURITY DEFINER functions (admin RPCs, get_user_groups_archive_state).
-- (also lives in migrations/20260602140000_admin_platform_metrics.sql)
-- ============================================
CREATE OR REPLACE FUNCTION public.group_is_auto_archived(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH g AS (
        SELECT id, last_activity_at
        FROM groups
        WHERE id = p_group_id AND is_active = TRUE
    ),
    members AS (
        SELECT gm.user_id
        FROM group_members gm
        WHERE gm.group_id = p_group_id AND gm.is_active = TRUE
    ),
    paid AS (
        SELECT e.paid_by AS user_id, e.currency, SUM(e.amount) AS amount
        FROM expenses e
        WHERE e.group_id = p_group_id AND e.is_deleted = FALSE
        GROUP BY e.paid_by, e.currency
    ),
    owed AS (
        SELECT es.user_id, e.currency, SUM(es.amount) AS amount
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.group_id = p_group_id AND e.is_deleted = FALSE
        GROUP BY es.user_id, e.currency
    ),
    settled_in AS (
        SELECT s.to_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id = p_group_id AND s.deleted_at IS NULL
        GROUP BY s.to_user_id, s.currency
    ),
    settled_out AS (
        SELECT s.from_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id = p_group_id AND s.deleted_at IS NULL
        GROUP BY s.from_user_id, s.currency
    ),
    currency_keys AS (
        SELECT user_id, currency FROM paid
        UNION SELECT user_id, currency FROM owed
        UNION SELECT user_id, currency FROM settled_in
        UNION SELECT user_id, currency FROM settled_out
    ),
    member_balances AS (
        SELECT ck.user_id, ck.currency,
            COALESCE(p.amount, 0) - COALESCE(o.amount, 0)
              + COALESCE(si.amount, 0) - COALESCE(so.amount, 0) AS net
        FROM currency_keys ck
        LEFT JOIN paid p ON p.user_id = ck.user_id AND p.currency = ck.currency
        LEFT JOIN owed o ON o.user_id = ck.user_id AND o.currency = ck.currency
        LEFT JOIN settled_in si ON si.user_id = ck.user_id AND si.currency = ck.currency
        LEFT JOIN settled_out so ON so.user_id = ck.user_id AND so.currency = ck.currency
        WHERE EXISTS (SELECT 1 FROM members m WHERE m.user_id = ck.user_id)
    ),
    all_settled AS (
        SELECT NOT EXISTS (
            SELECT 1 FROM member_balances mb WHERE ABS(mb.net) >= 0.01
        ) AS v
    )
    SELECT EXISTS (
        SELECT 1 FROM g
        CROSS JOIN all_settled a
        WHERE g.last_activity_at < (NOW() - INTERVAL '2 months')
          AND COALESCE(a.v, TRUE)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.group_is_auto_archived(UUID) FROM PUBLIC;
-- Not granted to authenticated: only SECURITY DEFINER callers use it.

CREATE OR REPLACE FUNCTION public.admin_get_platform_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_registered_users BIGINT;
    v_deleted_users    BIGINT;
    v_active_groups    BIGINT;
    v_archived_groups  BIGINT;
    v_deleted_groups   BIGINT;
    v_manual_archive_rows BIGINT;
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_registered_users FROM profiles WHERE is_active = TRUE;
    SELECT COUNT(*) INTO v_deleted_users FROM profiles WHERE is_active = FALSE;

    SELECT COUNT(*) INTO v_active_groups
    FROM groups g
    WHERE g.is_active = TRUE AND NOT public.group_is_auto_archived(g.id);

    SELECT COUNT(*) INTO v_archived_groups
    FROM groups g
    WHERE g.is_active = TRUE AND public.group_is_auto_archived(g.id);

    SELECT COUNT(*) INTO v_deleted_groups FROM groups WHERE is_active = FALSE;
    SELECT COUNT(*) INTO v_manual_archive_rows FROM group_user_archive;

    RETURN jsonb_build_object(
        'version', 1,
        'generatedAt', NOW(),
        'users', jsonb_build_object(
            'registered', v_registered_users,
            'deleted', v_deleted_users
        ),
        'groups', jsonb_build_object(
            'active', v_active_groups,
            'archived', v_archived_groups,
            'deleted', v_deleted_groups,
            'manualArchiveMemberships', v_manual_archive_rows
        )
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_platform_metrics() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_get_platform_metrics() TO authenticated;

-- ============================================
-- get_user_groups_archive_state()
-- Returns one row per active group the caller belongs to, with both
-- archive flags. Refactored to delegate auto-archive logic to
-- group_is_auto_archived().
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_groups_archive_state()
RETURNS TABLE (
    group_id UUID,
    is_archived_by_me BOOLEAN,
    is_auto_archived BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH my_groups AS (
        SELECT g.id, g.last_activity_at
        FROM groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = v_user_id
          AND gm.is_active = TRUE
          AND g.is_active = TRUE
    )
    SELECT
        mg.id,
        EXISTS (
            SELECT 1 FROM group_user_archive gua
            WHERE gua.user_id = v_user_id AND gua.group_id = mg.id
        ) AS is_archived_by_me,
        public.group_is_auto_archived(mg.id) AS is_auto_archived
    FROM my_groups mg;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_groups_archive_state() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_groups_archive_state() FROM PUBLIC, anon;
