-- Rename dodo_customer_id to lemon_squeezy_customer_id
ALTER TABLE public.organizations
RENAME COLUMN dodo_customer_id TO lemon_squeezy_customer_id;

-- Rename dodo_subscription_id to lemon_squeezy_subscription_id
ALTER TABLE public.organizations
RENAME COLUMN dodo_subscription_id TO lemon_squeezy_subscription_id;

-- Drop the old Dodo webhook handler function if it exists
DROP FUNCTION IF EXISTS public.dodo_webhook_handler();

-- You might also want to update any views or other functions that referenced these columns.
-- For example, if you had a function that selected from organizations:
-- CREATE OR REPLACE FUNCTION public.get_organization_details(org_id uuid)
-- RETURNS TABLE (
--   id uuid,
--   name text,
--   lemon_squeezy_customer_id text, -- Updated column name
--   lemon_squeezy_subscription_id text -- Updated column name
-- )
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   RETURN QUERY
--   SELECT
--     o.id,
--     o.name,
--     o.lemon_squeezy_customer_id,
--     o.lemon_squeezy_subscription_id
--   FROM
--     public.organizations o
--   WHERE
--     o.id = org_id;
-- END;
-- $$;

-- Note: This migration assumes no data loss is intended.
-- If you had existing data in dodo_customer_id or dodo_subscription_id,
-- it will be preserved under the new column names.