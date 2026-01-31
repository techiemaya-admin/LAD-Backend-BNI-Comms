--
-- PostgreSQL database dump
--

\restrict d0EHzZnwJ8TlBHuPKIZqk65DEuRmlfeJjpBzKJ4oespUJ8tCfEBDNkRY89LubyF

-- Dumped from database version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 17.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: lad_dev; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "lad_dev";


--
-- Name: SCHEMA "lad_dev"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "lad_dev" IS 'LAD Development Schema - Multi-tenant SaaS platform';


--
-- Name: campaign_activity_status; Type: TYPE; Schema: lad_dev; Owner: -
--

CREATE TYPE "lad_dev"."campaign_activity_status" AS ENUM (
    'pending',
    'queued',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'connected',
    'replied',
    'failed',
    'skipped',
    'cancelled'
);


--
-- Name: campaign_channel; Type: TYPE; Schema: lad_dev; Owner: -
--

CREATE TYPE "lad_dev"."campaign_channel" AS ENUM (
    'linkedin',
    'email',
    'voice',
    'whatsapp',
    'sms',
    'web'
);


--
-- Name: campaign_lead_status; Type: TYPE; Schema: lad_dev; Owner: -
--

CREATE TYPE "lad_dev"."campaign_lead_status" AS ENUM (
    'pending',
    'active',
    'completed',
    'stopped',
    'error'
);


--
-- Name: campaign_status; Type: TYPE; Schema: lad_dev; Owner: -
--

CREATE TYPE "lad_dev"."campaign_status" AS ENUM (
    'draft',
    'running',
    'paused',
    'completed',
    'stopped',
    'archived'
);


--
-- Name: campaign_step_type; Type: TYPE; Schema: lad_dev; Owner: -
--

CREATE TYPE "lad_dev"."campaign_step_type" AS ENUM (
    'linkedin_visit',
    'linkedin_connect',
    'linkedin_message',
    'email_send',
    'email_followup',
    'voice_call',
    'whatsapp_message',
    'delay',
    'condition'
);


--
-- Name: plan_tier; Type: TYPE; Schema: lad_dev; Owner: -
--

CREATE TYPE "lad_dev"."plan_tier" AS ENUM (
    'free',
    'starter',
    'professional',
    'enterprise'
);


--
-- Name: tenant_role; Type: TYPE; Schema: lad_dev; Owner: -
--

CREATE TYPE "lad_dev"."tenant_role" AS ENUM (
    'owner',
    'admin',
    'member',
    'viewer'
);


--
-- Name: tenant_status; Type: TYPE; Schema: lad_dev; Owner: -
--

CREATE TYPE "lad_dev"."tenant_status" AS ENUM (
    'active',
    'suspended',
    'trial',
    'cancelled'
);


--
-- Name: voice_batch_status; Type: TYPE; Schema: lad_dev; Owner: -
--

CREATE TYPE "lad_dev"."voice_batch_status" AS ENUM (
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: voice_call_status; Type: TYPE; Schema: lad_dev; Owner: -
--

CREATE TYPE "lad_dev"."voice_call_status" AS ENUM (
    'queued',
    'ringing',
    'in_progress',
    'completed',
    'failed',
    'no_answer',
    'busy',
    'cancelled'
);


--
-- Name: set_booking_assigned_user(); Type: FUNCTION; Schema: lad_dev; Owner: -
--

CREATE FUNCTION "lad_dev"."set_booking_assigned_user"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Pull assigned_user_id from leads
  SELECT assigned_user_id
  INTO NEW.assigned_user_id
  FROM lad_dev.leads
  WHERE id = NEW.lead_id
    AND tenant_id = NEW.tenant_id
    AND is_deleted = false;

  -- Block booking if lead is not assigned
  IF NEW.assigned_user_id IS NULL THEN
    RAISE EXCEPTION
      'Booking not allowed: lead % is not assigned to any user',
      NEW.lead_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: lad_dev; Owner: -
--

CREATE FUNCTION "lad_dev"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_call_logs_updated_at(); Type: FUNCTION; Schema: lad_dev; Owner: -
--

CREATE FUNCTION "lad_dev"."update_call_logs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$;


--
-- Name: update_campaigns_updated_at(); Type: FUNCTION; Schema: lad_dev; Owner: -
--

CREATE FUNCTION "lad_dev"."update_campaigns_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_comm_templates_updated_at(); Type: FUNCTION; Schema: lad_dev; Owner: -
--

CREATE FUNCTION "lad_dev"."update_comm_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: lad_dev; Owner: -
--

CREATE FUNCTION "lad_dev"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_voice_agent_numbers_updated_at(); Type: FUNCTION; Schema: lad_dev; Owner: -
--

CREATE FUNCTION "lad_dev"."update_voice_agent_numbers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$;


--
-- Name: update_voice_agents_updated_at(); Type: FUNCTION; Schema: lad_dev; Owner: -
--

CREATE FUNCTION "lad_dev"."update_voice_agents_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: billing_feature_entitlements; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."billing_feature_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "feature_key" character varying(100) NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "monthly_quota" numeric(18,6),
    "daily_quota" numeric(18,6),
    "allow_overages" boolean DEFAULT false NOT NULL,
    "overage_rate" numeric(18,10),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "billing_feature_entitlements"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."billing_feature_entitlements" IS 'Feature quotas and overage rules per tenant';


--
-- Name: billing_invoices; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."billing_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "invoice_number" character varying(50) NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "subtotal" numeric(18,6) NOT NULL,
    "tax" numeric(18,6) DEFAULT 0 NOT NULL,
    "total" numeric(18,6) NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "status" character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    "paid_at" timestamp with time zone,
    "payment_method" character varying(50),
    "line_items" "jsonb" DEFAULT '[]'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "due_at" timestamp with time zone,
    CONSTRAINT "billing_invoices_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'paid'::character varying, 'voided'::character varying, 'overdue'::character varying])::"text"[])))
);


--
-- Name: TABLE "billing_invoices"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."billing_invoices" IS 'Invoice generation (stub for future implementation)';


--
-- Name: billing_ledger_transactions; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."billing_ledger_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "transaction_type" character varying(20) NOT NULL,
    "amount" numeric(18,6) NOT NULL,
    "balance_before" numeric(18,6) NOT NULL,
    "balance_after" numeric(18,6) NOT NULL,
    "reference_type" character varying(50),
    "reference_id" "uuid",
    "idempotency_key" character varying(255) NOT NULL,
    "created_by" "uuid",
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_ledger_transactions_check" CHECK (("balance_after" = ("balance_before" + "amount"))),
    CONSTRAINT "billing_ledger_transactions_transaction_type_check" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['topup'::character varying, 'debit'::character varying, 'credit'::character varying, 'adjustment'::character varying, 'reservation'::character varying, 'release'::character varying])::"text"[])))
);


--
-- Name: TABLE "billing_ledger_transactions"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."billing_ledger_transactions" IS 'Immutable ledger of all credit transactions. Source of truth for balances.';


--
-- Name: billing_pricing_catalog; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."billing_pricing_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "category" character varying(50) NOT NULL,
    "provider" character varying(50) NOT NULL,
    "model" character varying(255) NOT NULL,
    "unit" character varying(30) NOT NULL,
    "unit_price" numeric(18,10) NOT NULL,
    "description" "text",
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_to" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: billing_usage_events; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."billing_usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "feature_key" character varying(100) NOT NULL,
    "usage_items" "jsonb" NOT NULL,
    "total_quantity" numeric(18,6) NOT NULL,
    "total_cost" numeric(18,6) NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "ledger_transaction_id" "uuid",
    "charged_at" timestamp with time zone,
    "idempotency_key" character varying(255) NOT NULL,
    "external_reference_id" character varying(255),
    "error_message" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_usage_events_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'charged'::character varying, 'voided'::character varying, 'failed'::character varying])::"text"[]))),
    CONSTRAINT "billing_usage_events_total_cost_check" CHECK (("total_cost" >= (0)::numeric))
);


--
-- Name: TABLE "billing_usage_events"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."billing_usage_events" IS 'Idempotent usage events from features. Supports multi-component charging.';


--
-- Name: COLUMN "billing_usage_events"."usage_items"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."billing_usage_events"."usage_items" IS 'Array of {category, provider, model, unit, quantity, unit_price, cost, description}';


--
-- Name: billing_wallets; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."billing_wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "current_balance" numeric(18,6) DEFAULT 0 NOT NULL,
    "reserved_balance" numeric(18,6) DEFAULT 0 NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "low_balance_threshold" numeric(18,6),
    "low_balance_notified_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_wallets_check" CHECK ((("user_id" IS NULL) OR ("tenant_id" IS NOT NULL))),
    CONSTRAINT "billing_wallets_current_balance_check" CHECK (("current_balance" >= (0)::numeric)),
    CONSTRAINT "billing_wallets_reserved_balance_check" CHECK (("reserved_balance" >= (0)::numeric)),
    CONSTRAINT "billing_wallets_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'closed'::character varying])::"text"[])))
);


--
-- Name: TABLE "billing_wallets"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."billing_wallets" IS 'Credit wallets for tenants and users. Balance is cached; ledger is source of truth.';


--
-- Name: COLUMN "billing_wallets"."reserved_balance"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."billing_wallets"."reserved_balance" IS 'Credits reserved for pending operations (e.g., quoted but not charged)';


--
-- Name: campaign_lead_activities; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."campaign_lead_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "campaign_lead_id" "uuid" NOT NULL,
    "step_id" "uuid",
    "step_type" character varying(50) NOT NULL,
    "action_type" character varying(50) NOT NULL,
    "status" character varying(50) NOT NULL,
    "channel" character varying(50),
    "message_content" "text",
    "subject" character varying(500),
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "executed_at" timestamp without time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "campaign_id" "uuid" NOT NULL
);


--
-- Name: TABLE "campaign_lead_activities"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."campaign_lead_activities" IS 'Activity log for all campaign actions';


--
-- Name: COLUMN "campaign_lead_activities"."status"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaign_lead_activities"."status" IS 'Activity status: sent (initiated), delivered (confirmed), connected (LinkedIn accepted), replied (response received), opened (email), clicked (link), error (failed)';


--
-- Name: campaign_leads; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."campaign_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "first_name" character varying(255),
    "last_name" character varying(255),
    "email" character varying(255),
    "linkedin_url" "text",
    "company_name" character varying(255),
    "title" character varying(255),
    "phone" character varying(50),
    "lead_data" "jsonb" DEFAULT '{}'::"jsonb",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "current_step_order" integer DEFAULT 0,
    "started_at" timestamp without time zone,
    "completed_at" timestamp without time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE "campaign_leads"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."campaign_leads" IS 'Leads assigned to campaigns with snapshot data';


--
-- Name: COLUMN "campaign_leads"."lead_data"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaign_leads"."lead_data" IS 'Full lead data including apollo_person_id, profile details, etc.';


--
-- Name: COLUMN "campaign_leads"."status"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaign_leads"."status" IS 'Lead status: pending (not started), active (in progress), completed (all steps done), stopped (condition not met), error (execution failed)';


--
-- Name: campaign_linkedin_accounts; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."campaign_linkedin_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "linkedin_account_id" "uuid" NOT NULL,
    "daily_limit" integer NOT NULL,
    "hourly_limit" integer,
    "actions_today" integer DEFAULT 0 NOT NULL,
    "last_reset_date" "date",
    "is_primary" boolean DEFAULT true NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "campaign_linkedin_accounts"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."campaign_linkedin_accounts" IS 'LinkedIn accounts mapped to campaigns with per-campaign rate limits';


--
-- Name: COLUMN "campaign_linkedin_accounts"."actions_today"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaign_linkedin_accounts"."actions_today" IS 'Number of actions performed today, reset daily';


--
-- Name: COLUMN "campaign_linkedin_accounts"."is_primary"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaign_linkedin_accounts"."is_primary" IS 'Whether this is the primary account for the campaign';


--
-- Name: COLUMN "campaign_linkedin_accounts"."priority"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaign_linkedin_accounts"."priority" IS 'Account priority (higher = used first when multiple accounts)';


--
-- Name: campaign_steps; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."campaign_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "type" character varying(50) NOT NULL,
    "order" integer NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "step_type" character varying(50),
    "step_order" integer
);


--
-- Name: TABLE "campaign_steps"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."campaign_steps" IS 'Campaign workflow steps (LinkedIn, email, delays, etc.)';


--
-- Name: COLUMN "campaign_steps"."config"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaign_steps"."config" IS 'Step configuration: message, subject, delay times, conditions, filters, etc.';


--
-- Name: campaigns; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "status" character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    "created_by" "uuid" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" boolean DEFAULT false,
    "execution_state" character varying(50) DEFAULT 'active'::character varying,
    "last_lead_check_at" timestamp with time zone,
    "next_run_at" timestamp with time zone,
    "last_execution_reason" "text"
);


--
-- Name: TABLE "campaigns"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."campaigns" IS 'Campaign definitions with tenant isolation';


--
-- Name: COLUMN "campaigns"."config"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaigns"."config" IS 'Campaign configuration: leads_per_day (daily limit), lead_gen_offset (total leads processed), last_lead_gen_date (last generation date)';


--
-- Name: COLUMN "campaigns"."execution_state"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaigns"."execution_state" IS 'Campaign execution state: active (normal execution), waiting_for_leads (no leads found, retry later), sleeping_until_next_day (daily limit reached), error (execution error)';


--
-- Name: COLUMN "campaigns"."last_lead_check_at"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaigns"."last_lead_check_at" IS 'Timestamp when we last checked for leads (used for retry logic)';


--
-- Name: COLUMN "campaigns"."next_run_at"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaigns"."next_run_at" IS 'Timestamp when campaign should run next (for sleeping/waiting states)';


--
-- Name: COLUMN "campaigns"."last_execution_reason"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."campaigns"."last_execution_reason" IS 'Reason why campaign was executed or skipped (for debugging and logging)';


--
-- Name: communication_templates; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."communication_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "template_key" character varying(100),
    "channel" character varying(50) NOT NULL,
    "category" character varying(100),
    "subject_template" "text",
    "content" "text" NOT NULL,
    "html_content" "text",
    "description" "text",
    "placeholders" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "is_builtin" boolean DEFAULT false,
    "agent_id" bigint,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text")
);


--
-- Name: company_search_cache; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."company_search_cache" (
    "id" bigint NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "search_keywords" character varying(255) NOT NULL,
    "search_location" character varying(255),
    "search_industry" character varying(255),
    "apollo_organization_id" character varying(255),
    "company_name" character varying(255),
    "company_domain" character varying(255),
    "company_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "page_number" integer DEFAULT 1 NOT NULL,
    "access_count" integer DEFAULT 0 NOT NULL,
    "last_accessed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "company_search_cache"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."company_search_cache" IS 'Apollo company search cache (tenant-scoped)';


--
-- Name: company_search_cache_id_seq; Type: SEQUENCE; Schema: lad_dev; Owner: -
--

CREATE SEQUENCE "lad_dev"."company_search_cache_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: company_search_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: lad_dev; Owner: -
--

ALTER SEQUENCE "lad_dev"."company_search_cache_id_seq" OWNED BY "lad_dev"."company_search_cache"."id";


--
-- Name: credit_transactions; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_credit_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "transaction_type" character varying(50) NOT NULL,
    "description" "text",
    "reference_type" character varying(50),
    "reference_id" "uuid",
    "balance_before" numeric(10,2),
    "balance_after" numeric(10,2),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: TABLE "credit_transactions"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."credit_transactions" IS 'Audit trail for all credit changes - tenant scoped';


--
-- Name: domain_events; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."domain_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "event_type" character varying(100) NOT NULL,
    "aggregate_type" character varying(100),
    "aggregate_id" "uuid",
    "payload" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "retry_count" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: TABLE "domain_events"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."domain_events" IS 'Event sourcing outbox for async processing and audit trail';


--
-- Name: education_counsellors; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."education_counsellors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" character varying(255),
    "designation" character varying(255),
    "specialization" character varying(255),
    "timezone" character varying(64) DEFAULT 'UTC'::character varying,
    "is_active" boolean DEFAULT true NOT NULL,
    "max_sessions_per_day" integer DEFAULT 20,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL
);


--
-- Name: education_students; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."education_students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "student_parent_name" character varying(255),
    "parent_designation" character varying(255),
    "program_interested_in" character varying(255),
    "country_interested" character varying(255),
    "intake_year" integer,
    "intake_month" character varying(20),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL
);


--
-- Name: email_accounts; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."email_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "smtp_host" character varying(255),
    "smtp_port" integer,
    "smtp_username" character varying(255),
    "smtp_password" "text",
    "smtp_secure" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "daily_send_limit" integer DEFAULT 200,
    "sent_today" integer DEFAULT 0,
    "last_reset_date" "date",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "email_accounts"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."email_accounts" IS 'SMTP email accounts for campaigns (tenant-scoped)';


--
-- Name: employees_cache; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."employees_cache" (
    "id" bigint NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" character varying(255),
    "company_name" character varying(255),
    "company_domain" character varying(255),
    "employee_name" character varying(255),
    "employee_title" character varying(255),
    "employee_email" character varying(255),
    "employee_phone" character varying(50),
    "employee_linkedin_url" "text",
    "employee_photo_url" "text",
    "employee_headline" "text",
    "employee_city" character varying(255),
    "employee_state" character varying(255),
    "employee_country" character varying(255),
    "apollo_person_id" character varying(255),
    "data_source" character varying(50) DEFAULT 'apollo_io'::character varying NOT NULL,
    "employee_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_fetched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "employees_cache"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."employees_cache" IS 'Apollo employees cache (tenant-scoped)';


--
-- Name: employees_cache_id_seq; Type: SEQUENCE; Schema: lad_dev; Owner: -
--

CREATE SEQUENCE "lad_dev"."employees_cache_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: lad_dev; Owner: -
--

ALTER SEQUENCE "lad_dev"."employees_cache_id_seq" OWNED BY "lad_dev"."employees_cache"."id";


--
-- Name: feature_flags; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature_key" character varying(100) NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "is_enabled" boolean DEFAULT false,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "expires_at" timestamp with time zone
);


--
-- Name: lead_attachments; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."lead_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" character varying(255),
    "file_type" character varying(100),
    "file_size" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false
);


--
-- Name: lead_bookings; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."lead_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "assigned_user_id" "uuid",
    "booking_type" character varying(30) NOT NULL,
    "booking_source" character varying(30) NOT NULL,
    "scheduled_at" timestamp without time zone NOT NULL,
    "timezone" character varying(50) DEFAULT 'GST'::character varying,
    "status" character varying(30) DEFAULT 'scheduled'::character varying NOT NULL,
    "call_result" character varying(30),
    "retry_count" integer DEFAULT 0,
    "parent_booking_id" "uuid",
    "notes" "text",
    "metadata" "jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "buffer_until" timestamp without time zone
);


--
-- Name: lead_notes; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."lead_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: lead_social; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."lead_social" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "linkedin" character varying(500),
    "whatsapp" character varying(50),
    "instagram" character varying(255),
    "facebook" character varying(255),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" "uuid" NOT NULL
);


--
-- Name: lead_stages; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."lead_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "key" character varying(50) NOT NULL,
    "label" character varying(100) NOT NULL,
    "description" "text",
    "color" character varying(20),
    "display_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: lead_statuses; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."lead_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "key" character varying(50) NOT NULL,
    "label" character varying(100) NOT NULL,
    "color" character varying(20),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: leads; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "source" character varying(100),
    "source_id" character varying(255),
    "first_name" character varying(255),
    "last_name" character varying(255),
    "email" character varying(255),
    "phone" character varying(50),
    "company_name" character varying(500),
    "company_domain" character varying(255),
    "title" character varying(255),
    "linkedin_url" character varying(500),
    "location" character varying(500),
    "status" character varying(50) DEFAULT 'active'::character varying,
    "priority" integer DEFAULT 0,
    "stage" character varying(50) DEFAULT 'new'::character varying,
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "notes" "text",
    "raw_data" "jsonb",
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "last_contacted_at" timestamp with time zone,
    "created_by_user_id" "uuid",
    "assigned_user_id" "uuid",
    "assigned_at" timestamp with time zone,
    "last_activity_at" timestamp with time zone,
    "next_follow_up_at" timestamp with time zone,
    "estimated_value" numeric(12,2),
    "currency" character varying(10) DEFAULT 'USD'::character varying,
    "is_archived" boolean DEFAULT false,
    "country_code" character varying(10),
    "base_number" bigint
);


--
-- Name: social_linkedin_accounts; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."social_linkedin_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" character varying(50) DEFAULT 'unipile'::character varying NOT NULL,
    "provider_account_id" character varying(255) NOT NULL,
    "account_name" character varying(255),
    "session_cookies" "text",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "status" character varying(30) DEFAULT 'active'::character varying NOT NULL,
    "last_verified_at" timestamp with time zone,
    "default_daily_limit" integer,
    "default_hourly_limit" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "social_linkedin_accounts"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."social_linkedin_accounts" IS 'Migrated from linkedin_accounts - all accounts now owned by tenant owner';


--
-- Name: COLUMN "social_linkedin_accounts"."provider_account_id"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."social_linkedin_accounts"."provider_account_id" IS 'External provider account ID (e.g., Unipile account ID)';


--
-- Name: COLUMN "social_linkedin_accounts"."status"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON COLUMN "lad_dev"."social_linkedin_accounts"."status" IS 'Account status: active, expired, revoked, error';


--
-- Name: linkedin_accounts; Type: VIEW; Schema: lad_dev; Owner: -
--

CREATE VIEW "lad_dev"."linkedin_accounts" AS
 SELECT "id",
    "tenant_id",
    "account_name",
    "provider_account_id" AS "unipile_account_id",
    "session_cookies",
    (("status")::"text" = 'active'::"text") AS "is_active",
    COALESCE("default_daily_limit", 100) AS "daily_action_limit",
    0 AS "actions_today",
    NULL::"date" AS "last_reset_date",
    "metadata",
    "created_at",
    "updated_at",
    "is_deleted"
   FROM "lad_dev"."social_linkedin_accounts" "sla"
  WHERE (("provider")::"text" = 'unipile'::"text");


--
-- Name: VIEW "linkedin_accounts"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON VIEW "lad_dev"."linkedin_accounts" IS 'Backward-compatible view of social_linkedin_accounts for legacy code';


--
-- Name: linkedin_accounts_legacy; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."linkedin_accounts_legacy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "account_name" character varying(255),
    "unipile_account_id" character varying(255),
    "session_cookies" "text",
    "is_active" boolean DEFAULT true,
    "daily_action_limit" integer DEFAULT 100,
    "actions_today" integer DEFAULT 0,
    "last_reset_date" "date",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE "linkedin_accounts_legacy"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."linkedin_accounts_legacy" IS 'LinkedIn automation accounts (tenant-scoped)';


--
-- Name: memberships; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "role" "lad_dev"."tenant_role" DEFAULT 'member'::"lad_dev"."tenant_role",
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


--
-- Name: TABLE "memberships"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."memberships" IS 'User-tenant relationships with roles and access control';


--
-- Name: tenant_features; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."tenant_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "feature_key" character varying(100) NOT NULL,
    "enabled" boolean DEFAULT true,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: TABLE "tenant_features"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."tenant_features" IS 'Feature enablement flags per tenant for subscription tiers';


--
-- Name: tenant_invitations; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."tenant_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "role" "lad_dev"."tenant_role" DEFAULT 'member'::"lad_dev"."tenant_role",
    "invited_by" "uuid" NOT NULL,
    "invitation_token" character varying(255) NOT NULL,
    "accepted_at" timestamp with time zone,
    "accepted_by" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


--
-- Name: TABLE "tenant_invitations"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."tenant_invitations" IS 'Invitation flow for adding users to tenants';


--
-- Name: tenants; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(100),
    "status" "lad_dev"."tenant_status" DEFAULT 'trial'::"lad_dev"."tenant_status",
    "plan_tier" "lad_dev"."plan_tier" DEFAULT 'free'::"lad_dev"."plan_tier",
    "email" character varying(255),
    "phone" character varying(50),
    "website" character varying(255),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "tenants_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


--
-- Name: TABLE "tenants"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."tenants" IS 'Organizations/companies using the platform';


--
-- Name: user_capabilities; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."user_capabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "capability_key" character varying(100) NOT NULL,
    "feature_key" character varying(100),
    "enabled" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: TABLE "user_capabilities"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."user_capabilities" IS 'Granular permissions for RBAC linked to features';


--
-- Name: user_credits; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."user_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "balance" numeric(10,2) DEFAULT 0.00,
    "monthly_usage" numeric(10,2) DEFAULT 0.00,
    "last_usage_reset" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_credits_balance_positive" CHECK (("balance" >= (0)::numeric))
);


--
-- Name: TABLE "user_credits"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."user_credits" IS 'Credit/wallet balance for usage-based billing';


--
-- Name: user_identities; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."user_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" character varying(50) NOT NULL,
    "provider_user_id" character varying(255) NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "provider_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: TABLE "user_identities"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."user_identities" IS 'External authentication provider identities (Clerk, Google, etc.)';


--
-- Name: users; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "password_hash" character varying(255),
    "first_name" character varying(100),
    "last_name" character varying(100),
    "avatar_url" "text",
    "phone" character varying(50),
    "primary_tenant_id" "uuid",
    "is_active" boolean DEFAULT true,
    "email_verified" boolean DEFAULT false,
    "phone_verified" boolean DEFAULT false,
    "last_login_at" timestamp with time zone,
    "password_changed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


--
-- Name: TABLE "users"; Type: COMMENT; Schema: lad_dev; Owner: -
--

COMMENT ON TABLE "lad_dev"."users" IS 'Global users - can belong to multiple tenants via memberships';


--
-- Name: voice_agent_numbers; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_agent_numbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "country_code" character varying(10) NOT NULL,
    "base_number" bigint NOT NULL,
    "provider" "text",
    "status" "text" DEFAULT 'active'::"text",
    "rules" "jsonb" DEFAULT '{}'::"jsonb",
    "default_agent_id" bigint,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text")
);


--
-- Name: voice_agent_voices; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_agent_voices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "description" "text",
    "gender" "text",
    "accent" "text",
    "provider" "text",
    "voice_sample_url" "text",
    "provider_voice_id" "text" NOT NULL,
    "provider_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text")
);


--
-- Name: voice_agents; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_agents" (
    "id" bigint NOT NULL,
    "tenant_id" "uuid",
    "name" character varying(255) NOT NULL,
    "gender" "text",
    "language" character varying(10) DEFAULT 'en'::character varying,
    "agent_instructions" "text",
    "system_instructions" "text",
    "outbound_starter_prompt" "text",
    "inbound_starter_prompt" "text",
    "voice_id" "uuid",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text")
);


--
-- Name: voice_agent_config_view; Type: VIEW; Schema: lad_dev; Owner: -
--

CREATE VIEW "lad_dev"."voice_agent_config_view" AS
 SELECT COALESCE("a"."tenant_id", "n"."tenant_id", "v"."tenant_id") AS "tenant_id",
    "a"."id" AS "agent_id",
    "a"."name" AS "agent_name",
    "a"."gender" AS "agent_gender",
    "a"."language" AS "agent_language",
    "v"."id" AS "voice_id",
    "v"."description" AS "voice_name",
    "v"."provider" AS "voice_provider",
    "v"."provider_voice_id",
    "v"."gender" AS "voice_gender",
    "v"."accent" AS "voice_accent",
    "v"."voice_sample_url",
    "n"."id" AS "number_id",
    (("n"."country_code")::"text" || ("n"."base_number")::"text") AS "phone_number",
    "n"."country_code",
    "n"."base_number",
    "n"."provider" AS "phone_provider",
    "n"."status" AS "phone_status"
   FROM (("lad_dev"."voice_agents" "a"
     LEFT JOIN "lad_dev"."voice_agent_voices" "v" ON (("a"."voice_id" = "v"."id")))
     LEFT JOIN "lad_dev"."voice_agent_numbers" "n" ON (("n"."default_agent_id" = "a"."id")));


--
-- Name: voice_agents_backup_marked_for_deletion; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_agents_backup_marked_for_deletion" (
    "id" bigint NOT NULL,
    "tenant_id" "uuid",
    "name" character varying(255) NOT NULL,
    "gender" "text",
    "language" character varying(20) DEFAULT 'en'::character varying,
    "agent_instructions" "text",
    "system_instructions" "text",
    "outbound_starter_prompt" "text",
    "inbound_starter_prompt" "text",
    "voice_id" "uuid",
    "created_by_user_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text") NOT NULL,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text") NOT NULL
);


--
-- Name: voice_agents_id_seq; Type: SEQUENCE; Schema: lad_dev; Owner: -
--

ALTER TABLE "lad_dev"."voice_agents_backup_marked_for_deletion" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "lad_dev"."voice_agents_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: voice_agents_id_seq1; Type: SEQUENCE; Schema: lad_dev; Owner: -
--

ALTER TABLE "lad_dev"."voice_agents" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "lad_dev"."voice_agents_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: voice_call_analysis; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_call_analysis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "call_log_id" "uuid",
    "summary" "text",
    "sentiment" character varying(20),
    "key_points" "jsonb" DEFAULT '[]'::"jsonb",
    "lead_extraction" "jsonb" DEFAULT '{}'::"jsonb",
    "raw_analysis" "jsonb" DEFAULT '{}'::"jsonb",
    "analysis_cost" numeric(10,4) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text")
);


--
-- Name: voice_call_batch_entries; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_call_batch_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "to_phone" character varying(50),
    "status" character varying(30) DEFAULT 'queued'::character varying NOT NULL,
    "last_error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "call_log_id" "uuid"
);


--
-- Name: voice_call_batches; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_call_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "status" "lad_dev"."voice_batch_status" DEFAULT 'queued'::"lad_dev"."voice_batch_status" NOT NULL,
    "total_calls" integer DEFAULT 0 NOT NULL,
    "completed_calls" integer DEFAULT 0 NOT NULL,
    "failed_calls" integer DEFAULT 0 NOT NULL,
    "initiated_by_user_id" "uuid",
    "agent_id" "uuid",
    "voice_id" "uuid",
    "from_number_id" "uuid",
    "scheduled_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: voice_call_logs; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_call_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "initiated_by_user_id" "uuid",
    "lead_id" "uuid",
    "to_country_code" character varying(10) NOT NULL,
    "to_base_number" bigint NOT NULL,
    "from_number_id" "uuid",
    "agent_id" bigint,
    "status" character varying(50) NOT NULL,
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "duration_seconds" integer DEFAULT 0,
    "recording_url" "text",
    "transcripts" "jsonb",
    "cost" numeric(10,4) DEFAULT 0,
    "currency" character varying(10) DEFAULT 'USD'::character varying,
    "cost_breakdown" "jsonb",
    "campaign_id" "uuid",
    "campaign_lead_id" "uuid",
    "campaign_step_id" "uuid",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "direction" character varying(20) DEFAULT 'outbound'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


--
-- Name: voice_call_logs_backup_marked_for_deletion; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_call_logs_backup_marked_for_deletion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "initiated_by_user_id" "uuid",
    "lead_id" "uuid",
    "to_phone" character varying(50),
    "agent_id" "uuid",
    "voice_id" "uuid",
    "from_number_id" "uuid",
    "campaign_id" "uuid",
    "campaign_lead_id" "uuid",
    "campaign_step_id" "uuid",
    "batch_id" "uuid",
    "provider" character varying(50) DEFAULT 'vapi'::character varying NOT NULL,
    "provider_call_id" character varying(255),
    "status" "lad_dev"."voice_call_status" DEFAULT 'queued'::"lad_dev"."voice_call_status" NOT NULL,
    "outcome" character varying(50),
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "duration_seconds" integer,
    "recording_url" "text",
    "transcript" "jsonb",
    "transcript_text" "text",
    "cost" numeric(12,4),
    "currency" character varying(10) DEFAULT 'USD'::character varying,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: voice_numbers_marked_for_deletion; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_numbers_marked_for_deletion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "phone_number" character varying(50) NOT NULL,
    "provider" character varying(50) NOT NULL,
    "direction" character varying(20) NOT NULL,
    "status" character varying(30) DEFAULT 'active'::character varying NOT NULL,
    "default_agent_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: voice_permissions; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "number_id" "uuid",
    "agent_id" "uuid",
    "permission_key" character varying(50) DEFAULT 'use'::character varying NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_voice_permissions_scope" CHECK ((("number_id" IS NOT NULL) OR ("agent_id" IS NOT NULL)))
);


--
-- Name: voice_provider_voices_marked_for_deletion; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_provider_voices_marked_for_deletion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "provider" character varying(50) NOT NULL,
    "provider_voice_id" character varying(255) NOT NULL,
    "name" character varying(255),
    "gender" character varying(30),
    "accent" character varying(50),
    "language" character varying(20),
    "preview_url" "text",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "provider_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: voice_user_profiles; Type: TABLE; Schema: lad_dev; Owner: -
--

CREATE TABLE "lad_dev"."voice_user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" character varying(50) NOT NULL,
    "external_user_id" character varying(255),
    "role" character varying(50) DEFAULT 'agent'::character varying,
    "default_agent_id" "uuid",
    "default_number_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false
);


--
-- Name: company_search_cache id; Type: DEFAULT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."company_search_cache" ALTER COLUMN "id" SET DEFAULT "nextval"('"lad_dev"."company_search_cache_id_seq"'::"regclass");


--
-- Name: employees_cache id; Type: DEFAULT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."employees_cache" ALTER COLUMN "id" SET DEFAULT "nextval"('"lad_dev"."employees_cache_id_seq"'::"regclass");


--
-- Name: billing_feature_entitlements billing_feature_entitlements_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_feature_entitlements"
    ADD CONSTRAINT "billing_feature_entitlements_pkey" PRIMARY KEY ("id");


--
-- Name: billing_feature_entitlements billing_feature_entitlements_tenant_id_feature_key_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_feature_entitlements"
    ADD CONSTRAINT "billing_feature_entitlements_tenant_id_feature_key_key" UNIQUE ("tenant_id", "feature_key");


--
-- Name: billing_invoices billing_invoices_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_invoices"
    ADD CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id");


--
-- Name: billing_invoices billing_invoices_tenant_id_invoice_number_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_invoices"
    ADD CONSTRAINT "billing_invoices_tenant_id_invoice_number_key" UNIQUE ("tenant_id", "invoice_number");


--
-- Name: billing_ledger_transactions billing_ledger_transactions_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_ledger_transactions"
    ADD CONSTRAINT "billing_ledger_transactions_pkey" PRIMARY KEY ("id");


--
-- Name: billing_ledger_transactions billing_ledger_transactions_tenant_id_idempotency_key_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_ledger_transactions"
    ADD CONSTRAINT "billing_ledger_transactions_tenant_id_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key");


--
-- Name: billing_pricing_catalog billing_pricing_catalog_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_pricing_catalog"
    ADD CONSTRAINT "billing_pricing_catalog_pkey" PRIMARY KEY ("id");


--
-- Name: billing_usage_events billing_usage_events_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_usage_events"
    ADD CONSTRAINT "billing_usage_events_pkey" PRIMARY KEY ("id");


--
-- Name: billing_usage_events billing_usage_events_tenant_id_idempotency_key_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_usage_events"
    ADD CONSTRAINT "billing_usage_events_tenant_id_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key");


--
-- Name: billing_wallets billing_wallets_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_wallets"
    ADD CONSTRAINT "billing_wallets_pkey" PRIMARY KEY ("id");


--
-- Name: billing_wallets billing_wallets_tenant_id_user_id_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_wallets"
    ADD CONSTRAINT "billing_wallets_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id");


--
-- Name: voice_call_logs call_logs_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs"
    ADD CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id");


--
-- Name: campaign_lead_activities campaign_lead_activities_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_lead_activities"
    ADD CONSTRAINT "campaign_lead_activities_pkey" PRIMARY KEY ("id");


--
-- Name: campaign_leads campaign_leads_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_leads"
    ADD CONSTRAINT "campaign_leads_pkey" PRIMARY KEY ("id");


--
-- Name: campaign_linkedin_accounts campaign_linkedin_accounts_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_linkedin_accounts"
    ADD CONSTRAINT "campaign_linkedin_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: campaign_steps campaign_steps_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_steps"
    ADD CONSTRAINT "campaign_steps_pkey" PRIMARY KEY ("id");


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");


--
-- Name: campaigns campaigns_tenant_id_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaigns"
    ADD CONSTRAINT "campaigns_tenant_id_key" UNIQUE ("tenant_id", "id");


--
-- Name: company_search_cache company_search_cache_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."company_search_cache"
    ADD CONSTRAINT "company_search_cache_pkey" PRIMARY KEY ("id");


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");


--
-- Name: domain_events domain_events_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."domain_events"
    ADD CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id");


--
-- Name: education_counsellors education_counsellors_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."education_counsellors"
    ADD CONSTRAINT "education_counsellors_pkey" PRIMARY KEY ("id");


--
-- Name: education_counsellors education_counsellors_tenant_user_unique; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."education_counsellors"
    ADD CONSTRAINT "education_counsellors_tenant_user_unique" UNIQUE ("tenant_id", "user_id");


--
-- Name: education_students education_students_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."education_students"
    ADD CONSTRAINT "education_students_pkey" PRIMARY KEY ("id");


--
-- Name: email_accounts email_accounts_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."email_accounts"
    ADD CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: employees_cache employees_cache_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."employees_cache"
    ADD CONSTRAINT "employees_cache_pkey" PRIMARY KEY ("id");


--
-- Name: feature_flags feature_flags_feature_key_tenant_user_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."feature_flags"
    ADD CONSTRAINT "feature_flags_feature_key_tenant_user_key" UNIQUE ("feature_key", "tenant_id", "user_id");


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id");


--
-- Name: lead_attachments lead_attachments_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_attachments"
    ADD CONSTRAINT "lead_attachments_pkey" PRIMARY KEY ("id");


--
-- Name: lead_bookings lead_bookings_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_bookings"
    ADD CONSTRAINT "lead_bookings_pkey" PRIMARY KEY ("id");


--
-- Name: lead_notes lead_notes_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_notes"
    ADD CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id");


--
-- Name: lead_social lead_social_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_social"
    ADD CONSTRAINT "lead_social_pkey" PRIMARY KEY ("id");


--
-- Name: lead_stages lead_stages_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_stages"
    ADD CONSTRAINT "lead_stages_pkey" PRIMARY KEY ("id");


--
-- Name: lead_stages lead_stages_tenant_id_display_order_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_stages"
    ADD CONSTRAINT "lead_stages_tenant_id_display_order_key" UNIQUE ("tenant_id", "display_order");


--
-- Name: lead_stages lead_stages_tenant_id_key_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_stages"
    ADD CONSTRAINT "lead_stages_tenant_id_key_key" UNIQUE ("tenant_id", "key");


--
-- Name: lead_statuses lead_statuses_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_statuses"
    ADD CONSTRAINT "lead_statuses_pkey" PRIMARY KEY ("id");


--
-- Name: lead_statuses lead_statuses_tenant_id_key_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_statuses"
    ADD CONSTRAINT "lead_statuses_tenant_id_key_key" UNIQUE ("tenant_id", "key");


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");


--
-- Name: leads leads_tenant_id_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."leads"
    ADD CONSTRAINT "leads_tenant_id_key" UNIQUE ("tenant_id", "id");


--
-- Name: linkedin_accounts_legacy linkedin_accounts_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."linkedin_accounts_legacy"
    ADD CONSTRAINT "linkedin_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");


--
-- Name: memberships memberships_user_tenant_unique; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."memberships"
    ADD CONSTRAINT "memberships_user_tenant_unique" UNIQUE ("user_id", "tenant_id");


--
-- Name: social_linkedin_accounts social_linkedin_accounts_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."social_linkedin_accounts"
    ADD CONSTRAINT "social_linkedin_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: tenant_features tenant_features_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."tenant_features"
    ADD CONSTRAINT "tenant_features_pkey" PRIMARY KEY ("id");


--
-- Name: tenant_features tenant_features_unique; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."tenant_features"
    ADD CONSTRAINT "tenant_features_unique" UNIQUE ("tenant_id", "feature_key");


--
-- Name: tenant_invitations tenant_invitations_invitation_token_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."tenant_invitations"
    ADD CONSTRAINT "tenant_invitations_invitation_token_key" UNIQUE ("invitation_token");


--
-- Name: tenant_invitations tenant_invitations_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."tenant_invitations"
    ADD CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id");


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");


--
-- Name: billing_pricing_catalog uq_billing_pricing_catalog; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_pricing_catalog"
    ADD CONSTRAINT "uq_billing_pricing_catalog" UNIQUE ("tenant_id", "category", "provider", "model", "unit", "effective_from");


--
-- Name: campaign_linkedin_accounts uq_campaign_linkedin_accounts; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_linkedin_accounts"
    ADD CONSTRAINT "uq_campaign_linkedin_accounts" UNIQUE ("tenant_id", "campaign_id", "linkedin_account_id");


--
-- Name: company_search_cache uq_company_search_cache; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."company_search_cache"
    ADD CONSTRAINT "uq_company_search_cache" UNIQUE ("tenant_id", "search_keywords", "search_location", "apollo_organization_id", "page_number");


--
-- Name: education_students uq_education_students_tenant_lead; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."education_students"
    ADD CONSTRAINT "uq_education_students_tenant_lead" UNIQUE ("tenant_id", "lead_id");


--
-- Name: email_accounts uq_email_accounts; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."email_accounts"
    ADD CONSTRAINT "uq_email_accounts" UNIQUE ("tenant_id", "email");


--
-- Name: employees_cache uq_employees_cache; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."employees_cache"
    ADD CONSTRAINT "uq_employees_cache" UNIQUE ("tenant_id", "company_id", "apollo_person_id");


--
-- Name: linkedin_accounts_legacy uq_linkedin_unipile; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."linkedin_accounts_legacy"
    ADD CONSTRAINT "uq_linkedin_unipile" UNIQUE ("tenant_id", "unipile_account_id");


--
-- Name: social_linkedin_accounts uq_social_linkedin_accounts; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."social_linkedin_accounts"
    ADD CONSTRAINT "uq_social_linkedin_accounts" UNIQUE ("tenant_id", "provider", "provider_account_id");


--
-- Name: voice_call_logs_backup_marked_for_deletion uq_voice_call_logs_provider; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs_backup_marked_for_deletion"
    ADD CONSTRAINT "uq_voice_call_logs_provider" UNIQUE ("tenant_id", "provider", "provider_call_id");


--
-- Name: voice_numbers_marked_for_deletion uq_voice_numbers; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_numbers_marked_for_deletion"
    ADD CONSTRAINT "uq_voice_numbers" UNIQUE ("tenant_id", "phone_number", "provider");


--
-- Name: user_capabilities user_capabilities_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_capabilities"
    ADD CONSTRAINT "user_capabilities_pkey" PRIMARY KEY ("id");


--
-- Name: user_capabilities user_capabilities_unique; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_capabilities"
    ADD CONSTRAINT "user_capabilities_unique" UNIQUE ("user_id", "capability_key", "tenant_id");


--
-- Name: user_credits user_credits_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_credits"
    ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("id");


--
-- Name: user_credits user_credits_user_unique; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_credits"
    ADD CONSTRAINT "user_credits_user_unique" UNIQUE ("user_id");


--
-- Name: user_identities user_identities_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_identities"
    ADD CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id");


--
-- Name: user_identities user_identities_provider_user_unique; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_identities"
    ADD CONSTRAINT "user_identities_provider_user_unique" UNIQUE ("provider", "provider_user_id");


--
-- Name: user_identities user_identities_user_provider_unique; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_identities"
    ADD CONSTRAINT "user_identities_user_provider_unique" UNIQUE ("user_id", "provider");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");


--
-- Name: communication_templates voice_agent_communication_templates_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."communication_templates"
    ADD CONSTRAINT "voice_agent_communication_templates_pkey" PRIMARY KEY ("id");


--
-- Name: voice_agent_numbers voice_agent_numbers_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agent_numbers"
    ADD CONSTRAINT "voice_agent_numbers_pkey" PRIMARY KEY ("id");


--
-- Name: voice_agent_voices voice_agent_voices_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agent_voices"
    ADD CONSTRAINT "voice_agent_voices_pkey" PRIMARY KEY ("id");


--
-- Name: voice_agents_backup_marked_for_deletion voice_agents_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agents_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_agents_pkey" PRIMARY KEY ("id");


--
-- Name: voice_agents voice_agents_pkey1; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agents"
    ADD CONSTRAINT "voice_agents_pkey1" PRIMARY KEY ("id");


--
-- Name: voice_call_analysis voice_call_analysis_call_log_id_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_analysis"
    ADD CONSTRAINT "voice_call_analysis_call_log_id_key" UNIQUE ("call_log_id");


--
-- Name: voice_call_analysis voice_call_analysis_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_analysis"
    ADD CONSTRAINT "voice_call_analysis_pkey" PRIMARY KEY ("id");


--
-- Name: voice_call_batch_entries voice_call_batch_entries_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_batch_entries"
    ADD CONSTRAINT "voice_call_batch_entries_pkey" PRIMARY KEY ("id");


--
-- Name: voice_call_batches voice_call_batches_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_batches"
    ADD CONSTRAINT "voice_call_batches_pkey" PRIMARY KEY ("id");


--
-- Name: voice_call_logs_backup_marked_for_deletion voice_call_logs_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_call_logs_pkey" PRIMARY KEY ("id");


--
-- Name: voice_numbers_marked_for_deletion voice_numbers_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_numbers_marked_for_deletion"
    ADD CONSTRAINT "voice_numbers_pkey" PRIMARY KEY ("id");


--
-- Name: voice_permissions voice_permissions_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_permissions"
    ADD CONSTRAINT "voice_permissions_pkey" PRIMARY KEY ("id");


--
-- Name: voice_provider_voices_marked_for_deletion voice_provider_voices_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_provider_voices_marked_for_deletion"
    ADD CONSTRAINT "voice_provider_voices_pkey" PRIMARY KEY ("id");


--
-- Name: voice_user_profiles voice_user_profiles_pkey; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_user_profiles"
    ADD CONSTRAINT "voice_user_profiles_pkey" PRIMARY KEY ("id");


--
-- Name: voice_user_profiles voice_user_profiles_tenant_id_user_id_key; Type: CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_user_profiles"
    ADD CONSTRAINT "voice_user_profiles_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id");


--
-- Name: idx_billing_entitlements_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_entitlements_tenant" ON "lad_dev"."billing_feature_entitlements" USING "btree" ("tenant_id");


--
-- Name: idx_billing_invoices_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_invoices_status" ON "lad_dev"."billing_invoices" USING "btree" ("status", "due_at");


--
-- Name: idx_billing_invoices_tenant_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_invoices_tenant_id" ON "lad_dev"."billing_invoices" USING "btree" ("tenant_id", "created_at" DESC);


--
-- Name: idx_billing_ledger_created_at; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_ledger_created_at" ON "lad_dev"."billing_ledger_transactions" USING "btree" ("created_at" DESC);


--
-- Name: idx_billing_ledger_idempotency; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_ledger_idempotency" ON "lad_dev"."billing_ledger_transactions" USING "btree" ("tenant_id", "idempotency_key");


--
-- Name: idx_billing_ledger_reference; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_ledger_reference" ON "lad_dev"."billing_ledger_transactions" USING "btree" ("reference_type", "reference_id");


--
-- Name: idx_billing_ledger_tenant_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_ledger_tenant_id" ON "lad_dev"."billing_ledger_transactions" USING "btree" ("tenant_id", "created_at" DESC);


--
-- Name: idx_billing_ledger_wallet_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_ledger_wallet_id" ON "lad_dev"."billing_ledger_transactions" USING "btree" ("wallet_id", "created_at" DESC);


--
-- Name: idx_billing_usage_charged_at; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_usage_charged_at" ON "lad_dev"."billing_usage_events" USING "btree" ("charged_at" DESC) WHERE ("charged_at" IS NOT NULL);


--
-- Name: idx_billing_usage_external_ref; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_usage_external_ref" ON "lad_dev"."billing_usage_events" USING "btree" ("external_reference_id") WHERE ("external_reference_id" IS NOT NULL);


--
-- Name: idx_billing_usage_feature; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_usage_feature" ON "lad_dev"."billing_usage_events" USING "btree" ("feature_key", "created_at" DESC);


--
-- Name: idx_billing_usage_idempotency; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_usage_idempotency" ON "lad_dev"."billing_usage_events" USING "btree" ("tenant_id", "idempotency_key");


--
-- Name: idx_billing_usage_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_usage_status" ON "lad_dev"."billing_usage_events" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_billing_usage_tenant_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_usage_tenant_id" ON "lad_dev"."billing_usage_events" USING "btree" ("tenant_id", "created_at" DESC);


--
-- Name: idx_billing_usage_user_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_usage_user_id" ON "lad_dev"."billing_usage_events" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);


--
-- Name: idx_billing_wallets_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_wallets_status" ON "lad_dev"."billing_wallets" USING "btree" ("status") WHERE (("status")::"text" <> 'active'::"text");


--
-- Name: idx_billing_wallets_tenant_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_wallets_tenant_id" ON "lad_dev"."billing_wallets" USING "btree" ("tenant_id");


--
-- Name: idx_billing_wallets_user_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_billing_wallets_user_id" ON "lad_dev"."billing_wallets" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);


--
-- Name: idx_bpc_active_lookup; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_bpc_active_lookup" ON "lad_dev"."billing_pricing_catalog" USING "btree" ("category", "provider", "model", "unit", "effective_from" DESC) WHERE (("is_active" = true) AND ("tenant_id" IS NULL));


--
-- Name: idx_bpc_active_lookup_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_bpc_active_lookup_tenant" ON "lad_dev"."billing_pricing_catalog" USING "btree" ("tenant_id", "category", "provider", "model", "unit", "effective_from" DESC) WHERE (("is_active" = true) AND ("tenant_id" IS NOT NULL));


--
-- Name: idx_bpc_category; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_bpc_category" ON "lad_dev"."billing_pricing_catalog" USING "btree" ("category");


--
-- Name: idx_bpc_effective_window; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_bpc_effective_window" ON "lad_dev"."billing_pricing_catalog" USING "btree" ("effective_from", "effective_to");


--
-- Name: idx_bpc_provider; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_bpc_provider" ON "lad_dev"."billing_pricing_catalog" USING "btree" ("provider");


--
-- Name: idx_call_logs_agent; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_call_logs_agent" ON "lad_dev"."voice_call_logs" USING "btree" ("agent_id");


--
-- Name: idx_call_logs_campaign; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_call_logs_campaign" ON "lad_dev"."voice_call_logs" USING "btree" ("campaign_id");


--
-- Name: idx_call_logs_lead; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_call_logs_lead" ON "lad_dev"."voice_call_logs" USING "btree" ("lead_id");


--
-- Name: idx_call_logs_started; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_call_logs_started" ON "lad_dev"."voice_call_logs" USING "btree" ("started_at");


--
-- Name: idx_call_logs_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_call_logs_status" ON "lad_dev"."voice_call_logs" USING "btree" ("status");


--
-- Name: idx_call_logs_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_call_logs_tenant" ON "lad_dev"."voice_call_logs" USING "btree" ("tenant_id");


--
-- Name: idx_campaign_lead_activities_created; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_lead_activities_created" ON "lad_dev"."campaign_lead_activities" USING "btree" ("created_at" DESC);


--
-- Name: idx_campaign_lead_activities_lead; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_lead_activities_lead" ON "lad_dev"."campaign_lead_activities" USING "btree" ("campaign_lead_id");


--
-- Name: idx_campaign_lead_activities_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_lead_activities_status" ON "lad_dev"."campaign_lead_activities" USING "btree" ("status");


--
-- Name: idx_campaign_lead_activities_step; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_lead_activities_step" ON "lad_dev"."campaign_lead_activities" USING "btree" ("step_id");


--
-- Name: idx_campaign_lead_activities_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_lead_activities_tenant" ON "lad_dev"."campaign_lead_activities" USING "btree" ("tenant_id");


--
-- Name: idx_campaign_leads_apollo; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_leads_apollo" ON "lad_dev"."campaign_leads" USING "btree" ((("lead_data" ->> 'apollo_person_id'::"text")));


--
-- Name: idx_campaign_leads_campaign; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_leads_campaign" ON "lad_dev"."campaign_leads" USING "btree" ("campaign_id");


--
-- Name: idx_campaign_leads_email; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_leads_email" ON "lad_dev"."campaign_leads" USING "btree" ("email");


--
-- Name: idx_campaign_leads_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_leads_status" ON "lad_dev"."campaign_leads" USING "btree" ("status");


--
-- Name: idx_campaign_leads_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_leads_tenant" ON "lad_dev"."campaign_leads" USING "btree" ("tenant_id");


--
-- Name: idx_campaign_leads_tenant_campaign; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_leads_tenant_campaign" ON "lad_dev"."campaign_leads" USING "btree" ("tenant_id", "campaign_id");


--
-- Name: idx_campaign_leads_tenant_lead; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_leads_tenant_lead" ON "lad_dev"."campaign_leads" USING "btree" ("tenant_id", "lead_id");


--
-- Name: idx_campaign_linkedin_accounts_account; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_linkedin_accounts_account" ON "lad_dev"."campaign_linkedin_accounts" USING "btree" ("tenant_id", "linkedin_account_id") WHERE ("is_deleted" = false);


--
-- Name: idx_campaign_linkedin_accounts_campaign; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_linkedin_accounts_campaign" ON "lad_dev"."campaign_linkedin_accounts" USING "btree" ("tenant_id", "campaign_id") WHERE ("is_deleted" = false);


--
-- Name: idx_campaign_linkedin_accounts_primary; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_linkedin_accounts_primary" ON "lad_dev"."campaign_linkedin_accounts" USING "btree" ("tenant_id", "campaign_id", "is_primary") WHERE (("is_deleted" = false) AND ("is_primary" = true));


--
-- Name: idx_campaign_steps_campaign; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_steps_campaign" ON "lad_dev"."campaign_steps" USING "btree" ("campaign_id");


--
-- Name: idx_campaign_steps_order; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_steps_order" ON "lad_dev"."campaign_steps" USING "btree" ("campaign_id", "order");


--
-- Name: idx_campaign_steps_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaign_steps_tenant" ON "lad_dev"."campaign_steps" USING "btree" ("tenant_id");


--
-- Name: idx_campaigns_created_by; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaigns_created_by" ON "lad_dev"."campaigns" USING "btree" ("created_by");


--
-- Name: idx_campaigns_created_by_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaigns_created_by_active" ON "lad_dev"."campaigns" USING "btree" ("created_by") WHERE ("is_deleted" = false);


--
-- Name: idx_campaigns_deleted; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaigns_deleted" ON "lad_dev"."campaigns" USING "btree" ("id", "updated_at") WHERE ("is_deleted" = true);


--
-- Name: idx_campaigns_execution_state; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaigns_execution_state" ON "lad_dev"."campaigns" USING "btree" ("execution_state") WHERE (("status")::"text" = 'running'::"text");


--
-- Name: idx_campaigns_next_run_at; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaigns_next_run_at" ON "lad_dev"."campaigns" USING "btree" ("next_run_at") WHERE ((("status")::"text" = 'running'::"text") AND (("execution_state")::"text" = ANY ((ARRAY['waiting_for_leads'::character varying, 'sleeping_until_next_day'::character varying])::"text"[])));


--
-- Name: idx_campaigns_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaigns_status" ON "lad_dev"."campaigns" USING "btree" ("status");


--
-- Name: idx_campaigns_status_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaigns_status_active" ON "lad_dev"."campaigns" USING "btree" ("tenant_id", "status") WHERE ("is_deleted" = false);


--
-- Name: idx_campaigns_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaigns_tenant" ON "lad_dev"."campaigns" USING "btree" ("tenant_id");


--
-- Name: idx_campaigns_tenant_created; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaigns_tenant_created" ON "lad_dev"."campaigns" USING "btree" ("tenant_id", "created_at" DESC) WHERE ("is_deleted" = false);


--
-- Name: idx_campaigns_tenant_id_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaigns_tenant_id_active" ON "lad_dev"."campaigns" USING "btree" ("tenant_id") WHERE ("is_deleted" = false);


--
-- Name: idx_campaigns_tenant_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_campaigns_tenant_status" ON "lad_dev"."campaigns" USING "btree" ("tenant_id", "status") WHERE ("is_deleted" = false);


--
-- Name: idx_comm_templates_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_comm_templates_active" ON "lad_dev"."communication_templates" USING "btree" ("is_active");


--
-- Name: idx_comm_templates_channel; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_comm_templates_channel" ON "lad_dev"."communication_templates" USING "btree" ("channel");


--
-- Name: idx_comm_templates_key; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_comm_templates_key" ON "lad_dev"."communication_templates" USING "btree" ("template_key");


--
-- Name: idx_comm_templates_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_comm_templates_tenant" ON "lad_dev"."communication_templates" USING "btree" ("tenant_id");


--
-- Name: idx_company_cache_tenant_access; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_company_cache_tenant_access" ON "lad_dev"."company_search_cache" USING "btree" ("tenant_id", "last_accessed_at" DESC);


--
-- Name: idx_company_cache_tenant_created; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_company_cache_tenant_created" ON "lad_dev"."company_search_cache" USING "btree" ("tenant_id", "created_at" DESC);


--
-- Name: idx_credit_transactions_created_at; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_credit_transactions_created_at" ON "lad_dev"."credit_transactions" USING "btree" ("created_at" DESC);


--
-- Name: idx_credit_transactions_tenant_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_credit_transactions_tenant_id" ON "lad_dev"."credit_transactions" USING "btree" ("tenant_id");


--
-- Name: idx_credit_transactions_type; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_credit_transactions_type" ON "lad_dev"."credit_transactions" USING "btree" ("transaction_type");


--
-- Name: idx_credit_transactions_user_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_credit_transactions_user_id" ON "lad_dev"."credit_transactions" USING "btree" ("user_id");


--
-- Name: idx_domain_events_aggregate; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_domain_events_aggregate" ON "lad_dev"."domain_events" USING "btree" ("aggregate_type", "aggregate_id");


--
-- Name: idx_domain_events_created_at; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_domain_events_created_at" ON "lad_dev"."domain_events" USING "btree" ("created_at" DESC);


--
-- Name: idx_domain_events_processed; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_domain_events_processed" ON "lad_dev"."domain_events" USING "btree" ("processed", "created_at") WHERE ("processed" = false);


--
-- Name: idx_domain_events_tenant_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_domain_events_tenant_id" ON "lad_dev"."domain_events" USING "btree" ("tenant_id");


--
-- Name: idx_domain_events_type; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_domain_events_type" ON "lad_dev"."domain_events" USING "btree" ("event_type");


--
-- Name: idx_education_counsellors_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_education_counsellors_active" ON "lad_dev"."education_counsellors" USING "btree" ("tenant_id", "is_active") WHERE ("is_deleted" = false);


--
-- Name: idx_education_counsellors_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_education_counsellors_tenant" ON "lad_dev"."education_counsellors" USING "btree" ("tenant_id");


--
-- Name: idx_education_counsellors_user; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_education_counsellors_user" ON "lad_dev"."education_counsellors" USING "btree" ("user_id");


--
-- Name: idx_education_students_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_education_students_tenant" ON "lad_dev"."education_students" USING "btree" ("tenant_id") WHERE ("is_deleted" = false);


--
-- Name: idx_education_students_tenant_lead; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_education_students_tenant_lead" ON "lad_dev"."education_students" USING "btree" ("tenant_id", "lead_id") WHERE ("is_deleted" = false);


--
-- Name: idx_email_accounts_tenant_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_email_accounts_tenant_active" ON "lad_dev"."email_accounts" USING "btree" ("tenant_id", "is_active") WHERE ("is_active" = true);


--
-- Name: idx_employees_cache_tenant_company; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_employees_cache_tenant_company" ON "lad_dev"."employees_cache" USING "btree" ("tenant_id", "company_id");


--
-- Name: idx_employees_cache_tenant_email; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_employees_cache_tenant_email" ON "lad_dev"."employees_cache" USING "btree" ("tenant_id", "employee_email") WHERE ("employee_email" IS NOT NULL);


--
-- Name: idx_feature_flags_enabled; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_feature_flags_enabled" ON "lad_dev"."feature_flags" USING "btree" ("is_enabled");


--
-- Name: idx_feature_flags_key; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_feature_flags_key" ON "lad_dev"."feature_flags" USING "btree" ("feature_key");


--
-- Name: idx_feature_flags_org; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_feature_flags_org" ON "lad_dev"."feature_flags" USING "btree" ("tenant_id");


--
-- Name: idx_feature_flags_tenant_enabled; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_feature_flags_tenant_enabled" ON "lad_dev"."feature_flags" USING "btree" ("tenant_id", "is_enabled") WHERE ("is_enabled" = true);


--
-- Name: idx_feature_flags_tenant_key; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_feature_flags_tenant_key" ON "lad_dev"."feature_flags" USING "btree" ("tenant_id", "feature_key");


--
-- Name: idx_feature_flags_tenant_user_key; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_feature_flags_tenant_user_key" ON "lad_dev"."feature_flags" USING "btree" ("tenant_id", "user_id", "feature_key") WHERE ("user_id" IS NOT NULL);


--
-- Name: idx_feature_flags_user; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_feature_flags_user" ON "lad_dev"."feature_flags" USING "btree" ("user_id");


--
-- Name: idx_lead_attachments_created; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_attachments_created" ON "lad_dev"."lead_attachments" USING "btree" ("created_at");


--
-- Name: idx_lead_attachments_deleted; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_attachments_deleted" ON "lad_dev"."lead_attachments" USING "btree" ("id", "created_at") WHERE ("is_deleted" = true);


--
-- Name: idx_lead_attachments_lead; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_attachments_lead" ON "lad_dev"."lead_attachments" USING "btree" ("lead_id");


--
-- Name: idx_lead_attachments_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_attachments_tenant" ON "lad_dev"."lead_attachments" USING "btree" ("tenant_id");


--
-- Name: idx_lead_attachments_tenant_lead_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_attachments_tenant_lead_active" ON "lad_dev"."lead_attachments" USING "btree" ("tenant_id", "lead_id") WHERE ("is_deleted" = false);


--
-- Name: idx_lead_attachments_uploaded_by_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_attachments_uploaded_by_active" ON "lad_dev"."lead_attachments" USING "btree" ("uploaded_by") WHERE ("is_deleted" = false);


--
-- Name: idx_lead_bookings_assigned_user_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_bookings_assigned_user_active" ON "lad_dev"."lead_bookings" USING "btree" ("assigned_user_id", "scheduled_at") WHERE (("status")::"text" = ANY ((ARRAY['scheduled'::character varying, 'confirmed'::character varying])::"text"[]));


--
-- Name: idx_lead_bookings_lead; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_bookings_lead" ON "lad_dev"."lead_bookings" USING "btree" ("lead_id");


--
-- Name: idx_lead_bookings_schedule; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_bookings_schedule" ON "lad_dev"."lead_bookings" USING "btree" ("scheduled_at");


--
-- Name: idx_lead_bookings_scheduled_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_bookings_scheduled_active" ON "lad_dev"."lead_bookings" USING "btree" ("tenant_id", "scheduled_at") WHERE (("status")::"text" = ANY ((ARRAY['scheduled'::character varying, 'confirmed'::character varying])::"text"[]));


--
-- Name: idx_lead_bookings_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_bookings_status" ON "lad_dev"."lead_bookings" USING "btree" ("status");


--
-- Name: idx_lead_bookings_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_bookings_tenant" ON "lad_dev"."lead_bookings" USING "btree" ("tenant_id");


--
-- Name: idx_lead_bookings_tenant_lead_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_bookings_tenant_lead_active" ON "lad_dev"."lead_bookings" USING "btree" ("tenant_id", "lead_id") WHERE (("status")::"text" <> 'cancelled'::"text");


--
-- Name: idx_lead_bookings_user; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_bookings_user" ON "lad_dev"."lead_bookings" USING "btree" ("assigned_user_id");


--
-- Name: idx_lead_notes_created_by; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_notes_created_by" ON "lad_dev"."lead_notes" USING "btree" ("created_by");


--
-- Name: idx_lead_notes_tenant_lead; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_notes_tenant_lead" ON "lad_dev"."lead_notes" USING "btree" ("tenant_id", "lead_id");


--
-- Name: idx_lead_social_lead_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_social_lead_id" ON "lad_dev"."lead_social" USING "btree" ("lead_id");


--
-- Name: idx_lead_social_tenant_lead; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_social_tenant_lead" ON "lad_dev"."lead_social" USING "btree" ("tenant_id", "lead_id");


--
-- Name: idx_lead_stages_tenant_order; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_lead_stages_tenant_order" ON "lad_dev"."lead_stages" USING "btree" ("tenant_id", "display_order");


--
-- Name: idx_leads_assigned_user; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_assigned_user" ON "lad_dev"."leads" USING "btree" ("assigned_user_id");


--
-- Name: idx_leads_created; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_created" ON "lad_dev"."leads" USING "btree" ("created_at");


--
-- Name: idx_leads_deleted; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_deleted" ON "lad_dev"."leads" USING "btree" ("id", "updated_at") WHERE ("is_deleted" = true);


--
-- Name: idx_leads_email_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_email_active" ON "lad_dev"."leads" USING "btree" ("email") WHERE (("is_deleted" = false) AND ("email" IS NOT NULL));


--
-- Name: idx_leads_next_follow_up; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_next_follow_up" ON "lad_dev"."leads" USING "btree" ("next_follow_up_at") WHERE ("next_follow_up_at" IS NOT NULL);


--
-- Name: idx_leads_org; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_org" ON "lad_dev"."leads" USING "btree" ("tenant_id");


--
-- Name: idx_leads_phone_split; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_phone_split" ON "lad_dev"."leads" USING "btree" ("country_code", "base_number");


--
-- Name: idx_leads_source; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_source" ON "lad_dev"."leads" USING "btree" ("source");


--
-- Name: idx_leads_stage; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_stage" ON "lad_dev"."leads" USING "btree" ("stage");


--
-- Name: idx_leads_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_status" ON "lad_dev"."leads" USING "btree" ("status");


--
-- Name: idx_leads_tenant_created; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_tenant_created" ON "lad_dev"."leads" USING "btree" ("tenant_id", "created_at" DESC) WHERE ("is_deleted" = false);


--
-- Name: idx_leads_tenant_email_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_tenant_email_active" ON "lad_dev"."leads" USING "btree" ("tenant_id", "lower"(("email")::"text")) WHERE (("email" IS NOT NULL) AND ("is_deleted" = false));


--
-- Name: idx_leads_tenant_id_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_tenant_id_active" ON "lad_dev"."leads" USING "btree" ("tenant_id") WHERE ("is_deleted" = false);


--
-- Name: idx_leads_tenant_phone_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_tenant_phone_active" ON "lad_dev"."leads" USING "btree" ("tenant_id", "phone") WHERE (("phone" IS NOT NULL) AND ("is_deleted" = false));


--
-- Name: idx_leads_tenant_stage; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_tenant_stage" ON "lad_dev"."leads" USING "btree" ("tenant_id", "stage") WHERE ("is_deleted" = false);


--
-- Name: idx_leads_tenant_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_tenant_status" ON "lad_dev"."leads" USING "btree" ("tenant_id", "status") WHERE ("is_deleted" = false);


--
-- Name: idx_leads_tenant_status_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_tenant_status_active" ON "lad_dev"."leads" USING "btree" ("tenant_id", "status") WHERE ("is_deleted" = false);


--
-- Name: idx_leads_user; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_leads_user" ON "lad_dev"."leads" USING "btree" ("user_id");


--
-- Name: idx_linkedin_accounts_tenant_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_linkedin_accounts_tenant_active" ON "lad_dev"."linkedin_accounts_legacy" USING "btree" ("tenant_id", "is_active") WHERE ("is_active" = true);


--
-- Name: idx_memberships_deleted_at; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_memberships_deleted_at" ON "lad_dev"."memberships" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);


--
-- Name: idx_memberships_one_owner_per_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE UNIQUE INDEX "idx_memberships_one_owner_per_tenant" ON "lad_dev"."memberships" USING "btree" ("tenant_id") WHERE (("role" = 'owner'::"lad_dev"."tenant_role") AND ("deleted_at" IS NULL));


--
-- Name: idx_memberships_role; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_memberships_role" ON "lad_dev"."memberships" USING "btree" ("role") WHERE ("deleted_at" IS NULL);


--
-- Name: idx_memberships_tenant_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_memberships_tenant_id" ON "lad_dev"."memberships" USING "btree" ("tenant_id") WHERE ("deleted_at" IS NULL);


--
-- Name: idx_memberships_user_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_memberships_user_id" ON "lad_dev"."memberships" USING "btree" ("user_id") WHERE ("deleted_at" IS NULL);


--
-- Name: idx_social_linkedin_accounts_provider; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_social_linkedin_accounts_provider" ON "lad_dev"."social_linkedin_accounts" USING "btree" ("provider", "provider_account_id");


--
-- Name: idx_social_linkedin_accounts_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_social_linkedin_accounts_tenant" ON "lad_dev"."social_linkedin_accounts" USING "btree" ("tenant_id") WHERE ("is_deleted" = false);


--
-- Name: idx_social_linkedin_accounts_user; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_social_linkedin_accounts_user" ON "lad_dev"."social_linkedin_accounts" USING "btree" ("tenant_id", "user_id") WHERE ("is_deleted" = false);


--
-- Name: idx_tenant_features_enabled; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_tenant_features_enabled" ON "lad_dev"."tenant_features" USING "btree" ("enabled") WHERE ("enabled" = true);


--
-- Name: idx_tenant_features_key; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_tenant_features_key" ON "lad_dev"."tenant_features" USING "btree" ("feature_key");


--
-- Name: idx_tenant_features_tenant_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_tenant_features_tenant_id" ON "lad_dev"."tenant_features" USING "btree" ("tenant_id");


--
-- Name: idx_tenant_invitations_email; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_tenant_invitations_email" ON "lad_dev"."tenant_invitations" USING "btree" ("lower"(("email")::"text"));


--
-- Name: idx_tenant_invitations_expires_at; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_tenant_invitations_expires_at" ON "lad_dev"."tenant_invitations" USING "btree" ("expires_at");


--
-- Name: idx_tenant_invitations_pending; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE UNIQUE INDEX "idx_tenant_invitations_pending" ON "lad_dev"."tenant_invitations" USING "btree" ("tenant_id", "lower"(("email")::"text")) WHERE (("accepted_at" IS NULL) AND ("deleted_at" IS NULL));


--
-- Name: idx_tenant_invitations_tenant_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_tenant_invitations_tenant_id" ON "lad_dev"."tenant_invitations" USING "btree" ("tenant_id");


--
-- Name: idx_tenant_invitations_token; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_tenant_invitations_token" ON "lad_dev"."tenant_invitations" USING "btree" ("invitation_token");


--
-- Name: idx_tenants_created_at; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_tenants_created_at" ON "lad_dev"."tenants" USING "btree" ("created_at" DESC);


--
-- Name: idx_tenants_deleted_at; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_tenants_deleted_at" ON "lad_dev"."tenants" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);


--
-- Name: idx_tenants_name_lower; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE UNIQUE INDEX "idx_tenants_name_lower" ON "lad_dev"."tenants" USING "btree" ("lower"(("name")::"text")) WHERE ("deleted_at" IS NULL);


--
-- Name: idx_tenants_plan_tier; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_tenants_plan_tier" ON "lad_dev"."tenants" USING "btree" ("plan_tier");


--
-- Name: idx_tenants_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_tenants_status" ON "lad_dev"."tenants" USING "btree" ("status") WHERE ("deleted_at" IS NULL);


--
-- Name: idx_user_capabilities_feature_key; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_user_capabilities_feature_key" ON "lad_dev"."user_capabilities" USING "btree" ("feature_key");


--
-- Name: idx_user_capabilities_key; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_user_capabilities_key" ON "lad_dev"."user_capabilities" USING "btree" ("capability_key");


--
-- Name: idx_user_capabilities_tenant_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_user_capabilities_tenant_id" ON "lad_dev"."user_capabilities" USING "btree" ("tenant_id");


--
-- Name: idx_user_capabilities_user_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_user_capabilities_user_id" ON "lad_dev"."user_capabilities" USING "btree" ("user_id");


--
-- Name: idx_user_credits_tenant_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_user_credits_tenant_id" ON "lad_dev"."user_credits" USING "btree" ("tenant_id");


--
-- Name: idx_user_credits_user_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_user_credits_user_id" ON "lad_dev"."user_credits" USING "btree" ("user_id");


--
-- Name: idx_user_identities_provider; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_user_identities_provider" ON "lad_dev"."user_identities" USING "btree" ("provider", "provider_user_id");


--
-- Name: idx_user_identities_user_id; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_user_identities_user_id" ON "lad_dev"."user_identities" USING "btree" ("user_id");


--
-- Name: idx_users_created_at; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_users_created_at" ON "lad_dev"."users" USING "btree" ("created_at" DESC);


--
-- Name: idx_users_deleted_at; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_users_deleted_at" ON "lad_dev"."users" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);


--
-- Name: idx_users_email_lower; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE UNIQUE INDEX "idx_users_email_lower" ON "lad_dev"."users" USING "btree" ("lower"(("email")::"text")) WHERE ("deleted_at" IS NULL);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_users_is_active" ON "lad_dev"."users" USING "btree" ("is_active") WHERE ("is_active" = true);


--
-- Name: idx_users_primary_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_users_primary_tenant" ON "lad_dev"."users" USING "btree" ("primary_tenant_id");


--
-- Name: idx_voice_agent_numbers_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_agent_numbers_status" ON "lad_dev"."voice_agent_numbers" USING "btree" ("status");


--
-- Name: idx_voice_agent_numbers_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_agent_numbers_tenant" ON "lad_dev"."voice_agent_numbers" USING "btree" ("tenant_id");


--
-- Name: idx_voice_agent_voices_provider; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_agent_voices_provider" ON "lad_dev"."voice_agent_voices" USING "btree" ("provider");


--
-- Name: idx_voice_agent_voices_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_agent_voices_tenant" ON "lad_dev"."voice_agent_voices" USING "btree" ("tenant_id");


--
-- Name: idx_voice_agents_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_agents_tenant" ON "lad_dev"."voice_agents_backup_marked_for_deletion" USING "btree" ("tenant_id");


--
-- Name: idx_voice_agents_voice; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_agents_voice" ON "lad_dev"."voice_agents_backup_marked_for_deletion" USING "btree" ("voice_id");


--
-- Name: idx_voice_call_analysis_call_log; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_analysis_call_log" ON "lad_dev"."voice_call_analysis" USING "btree" ("call_log_id");


--
-- Name: idx_voice_call_analysis_sentiment; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_analysis_sentiment" ON "lad_dev"."voice_call_analysis" USING "btree" ("sentiment");


--
-- Name: idx_voice_call_analysis_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_analysis_tenant" ON "lad_dev"."voice_call_analysis" USING "btree" ("tenant_id");


--
-- Name: idx_voice_call_batch_entries_batch; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_batch_entries_batch" ON "lad_dev"."voice_call_batch_entries" USING "btree" ("batch_id") WHERE ("is_deleted" = false);


--
-- Name: idx_voice_call_batch_entries_call_log; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_batch_entries_call_log" ON "lad_dev"."voice_call_batch_entries" USING "btree" ("call_log_id");


--
-- Name: idx_voice_call_batch_entries_lead; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_batch_entries_lead" ON "lad_dev"."voice_call_batch_entries" USING "btree" ("tenant_id", "lead_id") WHERE ("is_deleted" = false);


--
-- Name: idx_voice_call_batches_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_batches_status" ON "lad_dev"."voice_call_batches" USING "btree" ("status");


--
-- Name: idx_voice_call_batches_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_batches_tenant" ON "lad_dev"."voice_call_batches" USING "btree" ("tenant_id") WHERE ("is_deleted" = false);


--
-- Name: idx_voice_call_logs_batch; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_logs_batch" ON "lad_dev"."voice_call_logs_backup_marked_for_deletion" USING "btree" ("batch_id");


--
-- Name: idx_voice_call_logs_campaign; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_logs_campaign" ON "lad_dev"."voice_call_logs_backup_marked_for_deletion" USING "btree" ("tenant_id", "campaign_id") WHERE ("is_deleted" = false);


--
-- Name: idx_voice_call_logs_lead; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_logs_lead" ON "lad_dev"."voice_call_logs_backup_marked_for_deletion" USING "btree" ("tenant_id", "lead_id") WHERE ("is_deleted" = false);


--
-- Name: idx_voice_call_logs_started; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_logs_started" ON "lad_dev"."voice_call_logs_backup_marked_for_deletion" USING "btree" ("started_at" DESC);


--
-- Name: idx_voice_call_logs_status; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_logs_status" ON "lad_dev"."voice_call_logs_backup_marked_for_deletion" USING "btree" ("status");


--
-- Name: idx_voice_call_logs_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_call_logs_tenant" ON "lad_dev"."voice_call_logs_backup_marked_for_deletion" USING "btree" ("tenant_id") WHERE ("is_deleted" = false);


--
-- Name: idx_voice_numbers_phone; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_numbers_phone" ON "lad_dev"."voice_numbers_marked_for_deletion" USING "btree" ("phone_number");


--
-- Name: idx_voice_numbers_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_numbers_tenant" ON "lad_dev"."voice_numbers_marked_for_deletion" USING "btree" ("tenant_id") WHERE ("is_deleted" = false);


--
-- Name: idx_voice_permissions_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_permissions_tenant" ON "lad_dev"."voice_permissions" USING "btree" ("tenant_id") WHERE ("is_deleted" = false);


--
-- Name: idx_voice_permissions_user; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_permissions_user" ON "lad_dev"."voice_permissions" USING "btree" ("user_id") WHERE ("is_deleted" = false);


--
-- Name: idx_voice_provider_voices_language; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_provider_voices_language" ON "lad_dev"."voice_provider_voices_marked_for_deletion" USING "btree" ("language");


--
-- Name: idx_voice_provider_voices_provider; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_provider_voices_provider" ON "lad_dev"."voice_provider_voices_marked_for_deletion" USING "btree" ("provider");


--
-- Name: idx_voice_provider_voices_tenant_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_provider_voices_tenant_active" ON "lad_dev"."voice_provider_voices_marked_for_deletion" USING "btree" ("tenant_id") WHERE ("is_deleted" = false);


--
-- Name: idx_voice_user_profiles_tenant; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_user_profiles_tenant" ON "lad_dev"."voice_user_profiles" USING "btree" ("tenant_id") WHERE ("is_deleted" = false);


--
-- Name: idx_voice_user_profiles_user; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE INDEX "idx_voice_user_profiles_user" ON "lad_dev"."voice_user_profiles" USING "btree" ("user_id");


--
-- Name: uq_voice_provider_voices_active; Type: INDEX; Schema: lad_dev; Owner: -
--

CREATE UNIQUE INDEX "uq_voice_provider_voices_active" ON "lad_dev"."voice_provider_voices_marked_for_deletion" USING "btree" (COALESCE("tenant_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "provider", "provider_voice_id") WHERE ("is_deleted" = false);


--
-- Name: campaign_steps sync_campaign_step_columns_trigger; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "sync_campaign_step_columns_trigger" BEFORE INSERT OR UPDATE ON "lad_dev"."campaign_steps" FOR EACH ROW EXECUTE FUNCTION "public"."sync_campaign_step_columns"();


--
-- Name: campaign_lead_activities trg_campaign_lead_activities_updated; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "trg_campaign_lead_activities_updated" BEFORE UPDATE ON "lad_dev"."campaign_lead_activities" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."set_updated_at"();


--
-- Name: campaign_leads trg_campaign_leads_updated; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "trg_campaign_leads_updated" BEFORE UPDATE ON "lad_dev"."campaign_leads" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."set_updated_at"();


--
-- Name: campaign_linkedin_accounts trg_campaign_linkedin_accounts_updated; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "trg_campaign_linkedin_accounts_updated" BEFORE UPDATE ON "lad_dev"."campaign_linkedin_accounts" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."set_updated_at"();


--
-- Name: campaign_steps trg_campaign_steps_updated; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "trg_campaign_steps_updated" BEFORE UPDATE ON "lad_dev"."campaign_steps" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."set_updated_at"();


--
-- Name: campaigns trg_campaigns_updated; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "trg_campaigns_updated" BEFORE UPDATE ON "lad_dev"."campaigns" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."set_updated_at"();


--
-- Name: company_search_cache trg_company_search_cache_updated; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "trg_company_search_cache_updated" BEFORE UPDATE ON "lad_dev"."company_search_cache" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."set_updated_at"();


--
-- Name: email_accounts trg_email_accounts_updated; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "trg_email_accounts_updated" BEFORE UPDATE ON "lad_dev"."email_accounts" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."set_updated_at"();


--
-- Name: employees_cache trg_employees_cache_updated; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "trg_employees_cache_updated" BEFORE UPDATE ON "lad_dev"."employees_cache" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."set_updated_at"();


--
-- Name: linkedin_accounts_legacy trg_linkedin_accounts_updated; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "trg_linkedin_accounts_updated" BEFORE UPDATE ON "lad_dev"."linkedin_accounts_legacy" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."set_updated_at"();


--
-- Name: lead_bookings trg_set_booking_assigned_user; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "trg_set_booking_assigned_user" BEFORE INSERT ON "lad_dev"."lead_bookings" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."set_booking_assigned_user"();


--
-- Name: social_linkedin_accounts trg_social_linkedin_accounts_updated; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "trg_social_linkedin_accounts_updated" BEFORE UPDATE ON "lad_dev"."social_linkedin_accounts" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."set_updated_at"();


--
-- Name: billing_feature_entitlements update_billing_entitlements_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_billing_entitlements_updated_at" BEFORE UPDATE ON "lad_dev"."billing_feature_entitlements" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: billing_invoices update_billing_invoices_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_billing_invoices_updated_at" BEFORE UPDATE ON "lad_dev"."billing_invoices" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: billing_usage_events update_billing_usage_events_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_billing_usage_events_updated_at" BEFORE UPDATE ON "lad_dev"."billing_usage_events" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: billing_wallets update_billing_wallets_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_billing_wallets_updated_at" BEFORE UPDATE ON "lad_dev"."billing_wallets" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: voice_call_logs update_call_logs_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_call_logs_updated_at" BEFORE UPDATE ON "lad_dev"."voice_call_logs" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_call_logs_updated_at"();


--
-- Name: campaign_lead_activities update_campaign_lead_activities_timestamp; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_campaign_lead_activities_timestamp" BEFORE UPDATE ON "lad_dev"."campaign_lead_activities" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_campaigns_updated_at"();


--
-- Name: campaign_leads update_campaign_leads_timestamp; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_campaign_leads_timestamp" BEFORE UPDATE ON "lad_dev"."campaign_leads" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_campaigns_updated_at"();


--
-- Name: campaign_steps update_campaign_steps_timestamp; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_campaign_steps_timestamp" BEFORE UPDATE ON "lad_dev"."campaign_steps" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_campaigns_updated_at"();


--
-- Name: campaigns update_campaigns_timestamp; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_campaigns_timestamp" BEFORE UPDATE ON "lad_dev"."campaigns" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_campaigns_updated_at"();


--
-- Name: communication_templates update_comm_templates_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_comm_templates_updated_at" BEFORE UPDATE ON "lad_dev"."communication_templates" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_comm_templates_updated_at"();


--
-- Name: memberships update_memberships_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_memberships_updated_at" BEFORE UPDATE ON "lad_dev"."memberships" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: tenant_features update_tenant_features_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_tenant_features_updated_at" BEFORE UPDATE ON "lad_dev"."tenant_features" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: tenant_invitations update_tenant_invitations_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_tenant_invitations_updated_at" BEFORE UPDATE ON "lad_dev"."tenant_invitations" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_tenants_updated_at" BEFORE UPDATE ON "lad_dev"."tenants" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: user_capabilities update_user_capabilities_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_user_capabilities_updated_at" BEFORE UPDATE ON "lad_dev"."user_capabilities" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: user_credits update_user_credits_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_user_credits_updated_at" BEFORE UPDATE ON "lad_dev"."user_credits" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: user_identities update_user_identities_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_user_identities_updated_at" BEFORE UPDATE ON "lad_dev"."user_identities" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "lad_dev"."users" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: voice_agent_numbers update_voice_agent_numbers_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_voice_agent_numbers_updated_at" BEFORE UPDATE ON "lad_dev"."voice_agent_numbers" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_voice_agent_numbers_updated_at"();


--
-- Name: voice_agent_voices update_voice_agent_voices_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_voice_agent_voices_updated_at" BEFORE UPDATE ON "lad_dev"."voice_agent_voices" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: voice_agents update_voice_agents_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_voice_agents_updated_at" BEFORE UPDATE ON "lad_dev"."voice_agents" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_voice_agents_updated_at"();


--
-- Name: voice_agents_backup_marked_for_deletion update_voice_agents_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_voice_agents_updated_at" BEFORE UPDATE ON "lad_dev"."voice_agents_backup_marked_for_deletion" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: voice_call_analysis update_voice_call_analysis_updated_at; Type: TRIGGER; Schema: lad_dev; Owner: -
--

CREATE TRIGGER "update_voice_call_analysis_updated_at" BEFORE UPDATE ON "lad_dev"."voice_call_analysis" FOR EACH ROW EXECUTE FUNCTION "lad_dev"."update_updated_at_column"();


--
-- Name: billing_feature_entitlements billing_feature_entitlements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_feature_entitlements"
    ADD CONSTRAINT "billing_feature_entitlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: billing_invoices billing_invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_invoices"
    ADD CONSTRAINT "billing_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: billing_ledger_transactions billing_ledger_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_ledger_transactions"
    ADD CONSTRAINT "billing_ledger_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lad_dev"."users"("id");


--
-- Name: billing_ledger_transactions billing_ledger_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_ledger_transactions"
    ADD CONSTRAINT "billing_ledger_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: billing_ledger_transactions billing_ledger_transactions_wallet_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_ledger_transactions"
    ADD CONSTRAINT "billing_ledger_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "lad_dev"."billing_wallets"("id") ON DELETE CASCADE;


--
-- Name: billing_pricing_catalog billing_pricing_catalog_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_pricing_catalog"
    ADD CONSTRAINT "billing_pricing_catalog_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: billing_usage_events billing_usage_events_ledger_transaction_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_usage_events"
    ADD CONSTRAINT "billing_usage_events_ledger_transaction_id_fkey" FOREIGN KEY ("ledger_transaction_id") REFERENCES "lad_dev"."billing_ledger_transactions"("id");


--
-- Name: billing_usage_events billing_usage_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_usage_events"
    ADD CONSTRAINT "billing_usage_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: billing_usage_events billing_usage_events_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_usage_events"
    ADD CONSTRAINT "billing_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lad_dev"."users"("id") ON DELETE SET NULL;


--
-- Name: billing_wallets billing_wallets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_wallets"
    ADD CONSTRAINT "billing_wallets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: billing_wallets billing_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."billing_wallets"
    ADD CONSTRAINT "billing_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lad_dev"."users"("id") ON DELETE CASCADE;


--
-- Name: voice_call_logs call_logs_agent_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs"
    ADD CONSTRAINT "call_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "lad_dev"."voice_agents"("id");


--
-- Name: voice_call_logs call_logs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs"
    ADD CONSTRAINT "call_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "lad_dev"."campaigns"("id");


--
-- Name: voice_call_logs call_logs_campaign_lead_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs"
    ADD CONSTRAINT "call_logs_campaign_lead_id_fkey" FOREIGN KEY ("campaign_lead_id") REFERENCES "lad_dev"."campaign_leads"("id");


--
-- Name: voice_call_logs call_logs_campaign_step_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs"
    ADD CONSTRAINT "call_logs_campaign_step_id_fkey" FOREIGN KEY ("campaign_step_id") REFERENCES "lad_dev"."campaign_steps"("id");


--
-- Name: voice_call_logs call_logs_from_number_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs"
    ADD CONSTRAINT "call_logs_from_number_id_fkey" FOREIGN KEY ("from_number_id") REFERENCES "lad_dev"."voice_agent_numbers"("id");


--
-- Name: voice_call_logs call_logs_initiated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs"
    ADD CONSTRAINT "call_logs_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "lad_dev"."users"("id");


--
-- Name: voice_call_logs call_logs_lead_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs"
    ADD CONSTRAINT "call_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lad_dev"."leads"("id");


--
-- Name: voice_call_logs call_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs"
    ADD CONSTRAINT "call_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id");


--
-- Name: campaign_lead_activities campaign_lead_activities_campaign_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_lead_activities"
    ADD CONSTRAINT "campaign_lead_activities_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "lad_dev"."campaigns"("id") ON DELETE CASCADE;


--
-- Name: campaign_leads campaign_leads_tenant_campaign_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_leads"
    ADD CONSTRAINT "campaign_leads_tenant_campaign_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "lad_dev"."campaigns"("tenant_id", "id") ON DELETE CASCADE;


--
-- Name: campaign_leads campaign_leads_tenant_lead_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_leads"
    ADD CONSTRAINT "campaign_leads_tenant_lead_fkey" FOREIGN KEY ("tenant_id", "lead_id") REFERENCES "lad_dev"."leads"("tenant_id", "id") ON DELETE CASCADE;


--
-- Name: campaign_linkedin_accounts campaign_linkedin_accounts_campaign_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_linkedin_accounts"
    ADD CONSTRAINT "campaign_linkedin_accounts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "lad_dev"."campaigns"("id") ON DELETE CASCADE;


--
-- Name: campaign_linkedin_accounts campaign_linkedin_accounts_linkedin_account_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_linkedin_accounts"
    ADD CONSTRAINT "campaign_linkedin_accounts_linkedin_account_id_fkey" FOREIGN KEY ("linkedin_account_id") REFERENCES "lad_dev"."social_linkedin_accounts"("id") ON DELETE CASCADE;


--
-- Name: campaign_linkedin_accounts campaign_linkedin_accounts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_linkedin_accounts"
    ADD CONSTRAINT "campaign_linkedin_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: campaign_steps campaign_steps_tenant_campaign_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_steps"
    ADD CONSTRAINT "campaign_steps_tenant_campaign_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "lad_dev"."campaigns"("tenant_id", "id") ON DELETE CASCADE;


--
-- Name: campaigns campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaigns"
    ADD CONSTRAINT "campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lad_dev"."users"("id") ON DELETE RESTRICT;


--
-- Name: company_search_cache company_search_cache_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."company_search_cache"
    ADD CONSTRAINT "company_search_cache_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: credit_transactions credit_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: credit_transactions credit_transactions_user_credit_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_credit_id_fkey" FOREIGN KEY ("user_credit_id") REFERENCES "lad_dev"."user_credits"("id") ON DELETE SET NULL;


--
-- Name: credit_transactions credit_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lad_dev"."users"("id") ON DELETE CASCADE;


--
-- Name: domain_events domain_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."domain_events"
    ADD CONSTRAINT "domain_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: education_counsellors education_counsellors_user_fk; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."education_counsellors"
    ADD CONSTRAINT "education_counsellors_user_fk" FOREIGN KEY ("user_id") REFERENCES "lad_dev"."users"("id") ON DELETE CASCADE;


--
-- Name: education_students education_students_lead_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."education_students"
    ADD CONSTRAINT "education_students_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lad_dev"."leads"("id");


--
-- Name: email_accounts email_accounts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."email_accounts"
    ADD CONSTRAINT "email_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: employees_cache employees_cache_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."employees_cache"
    ADD CONSTRAINT "employees_cache_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: lead_bookings fk_booking_assigned_user; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_bookings"
    ADD CONSTRAINT "fk_booking_assigned_user" FOREIGN KEY ("assigned_user_id") REFERENCES "lad_dev"."users"("id");


--
-- Name: campaign_lead_activities fk_campaign_lead_activities_lead; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_lead_activities"
    ADD CONSTRAINT "fk_campaign_lead_activities_lead" FOREIGN KEY ("campaign_lead_id") REFERENCES "lad_dev"."campaign_leads"("id") ON DELETE CASCADE;


--
-- Name: campaign_lead_activities fk_campaign_lead_activities_step; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_lead_activities"
    ADD CONSTRAINT "fk_campaign_lead_activities_step" FOREIGN KEY ("step_id") REFERENCES "lad_dev"."campaign_steps"("id") ON DELETE SET NULL;


--
-- Name: campaign_lead_activities fk_campaign_lead_activities_tenant; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_lead_activities"
    ADD CONSTRAINT "fk_campaign_lead_activities_tenant" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: campaign_leads fk_campaign_leads_campaign; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_leads"
    ADD CONSTRAINT "fk_campaign_leads_campaign" FOREIGN KEY ("campaign_id") REFERENCES "lad_dev"."campaigns"("id") ON DELETE CASCADE;


--
-- Name: campaign_leads fk_campaign_leads_tenant; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_leads"
    ADD CONSTRAINT "fk_campaign_leads_tenant" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: campaign_steps fk_campaign_steps_campaign; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_steps"
    ADD CONSTRAINT "fk_campaign_steps_campaign" FOREIGN KEY ("campaign_id") REFERENCES "lad_dev"."campaigns"("id") ON DELETE CASCADE;


--
-- Name: campaign_steps fk_campaign_steps_tenant; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaign_steps"
    ADD CONSTRAINT "fk_campaign_steps_tenant" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: campaigns fk_campaigns_tenant; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."campaigns"
    ADD CONSTRAINT "fk_campaigns_tenant" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: lead_attachments lead_attachments_tenant_lead_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_attachments"
    ADD CONSTRAINT "lead_attachments_tenant_lead_fkey" FOREIGN KEY ("tenant_id", "lead_id") REFERENCES "lad_dev"."leads"("tenant_id", "id") ON DELETE CASCADE;


--
-- Name: lead_attachments lead_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_attachments"
    ADD CONSTRAINT "lead_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "lad_dev"."users"("id") ON DELETE SET NULL;


--
-- Name: lead_bookings lead_bookings_assigned_user_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_bookings"
    ADD CONSTRAINT "lead_bookings_assigned_user_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "lad_dev"."users"("id") ON DELETE SET NULL;


--
-- Name: lead_bookings lead_bookings_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_bookings"
    ADD CONSTRAINT "lead_bookings_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "lad_dev"."users"("id");


--
-- Name: lead_bookings lead_bookings_parent_booking_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_bookings"
    ADD CONSTRAINT "lead_bookings_parent_booking_id_fkey" FOREIGN KEY ("parent_booking_id") REFERENCES "lad_dev"."lead_bookings"("id");


--
-- Name: lead_bookings lead_bookings_tenant_lead_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_bookings"
    ADD CONSTRAINT "lead_bookings_tenant_lead_fkey" FOREIGN KEY ("tenant_id", "lead_id") REFERENCES "lad_dev"."leads"("tenant_id", "id") ON DELETE CASCADE;


--
-- Name: lead_notes lead_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_notes"
    ADD CONSTRAINT "lead_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lad_dev"."users"("id") ON DELETE RESTRICT;


--
-- Name: lead_notes lead_notes_tenant_lead_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_notes"
    ADD CONSTRAINT "lead_notes_tenant_lead_fkey" FOREIGN KEY ("tenant_id", "lead_id") REFERENCES "lad_dev"."leads"("tenant_id", "id") ON DELETE CASCADE;


--
-- Name: lead_social lead_social_tenant_lead_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."lead_social"
    ADD CONSTRAINT "lead_social_tenant_lead_fkey" FOREIGN KEY ("tenant_id", "lead_id") REFERENCES "lad_dev"."leads"("tenant_id", "id") ON DELETE CASCADE;


--
-- Name: linkedin_accounts_legacy linkedin_accounts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."linkedin_accounts_legacy"
    ADD CONSTRAINT "linkedin_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: memberships memberships_invited_by_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."memberships"
    ADD CONSTRAINT "memberships_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "lad_dev"."users"("id");


--
-- Name: memberships memberships_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."memberships"
    ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: memberships memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."memberships"
    ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lad_dev"."users"("id") ON DELETE CASCADE;


--
-- Name: social_linkedin_accounts social_linkedin_accounts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."social_linkedin_accounts"
    ADD CONSTRAINT "social_linkedin_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: social_linkedin_accounts social_linkedin_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."social_linkedin_accounts"
    ADD CONSTRAINT "social_linkedin_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lad_dev"."users"("id") ON DELETE CASCADE;


--
-- Name: tenant_features tenant_features_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."tenant_features"
    ADD CONSTRAINT "tenant_features_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: tenant_invitations tenant_invitations_accepted_by_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."tenant_invitations"
    ADD CONSTRAINT "tenant_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "lad_dev"."users"("id");


--
-- Name: tenant_invitations tenant_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."tenant_invitations"
    ADD CONSTRAINT "tenant_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "lad_dev"."users"("id") ON DELETE CASCADE;


--
-- Name: tenant_invitations tenant_invitations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."tenant_invitations"
    ADD CONSTRAINT "tenant_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: user_capabilities user_capabilities_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_capabilities"
    ADD CONSTRAINT "user_capabilities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: user_capabilities user_capabilities_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_capabilities"
    ADD CONSTRAINT "user_capabilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lad_dev"."users"("id") ON DELETE CASCADE;


--
-- Name: user_credits user_credits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_credits"
    ADD CONSTRAINT "user_credits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE SET NULL;


--
-- Name: user_credits user_credits_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_credits"
    ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lad_dev"."users"("id") ON DELETE CASCADE;


--
-- Name: user_identities user_identities_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."user_identities"
    ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lad_dev"."users"("id") ON DELETE CASCADE;


--
-- Name: users users_primary_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."users"
    ADD CONSTRAINT "users_primary_tenant_id_fkey" FOREIGN KEY ("primary_tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE SET NULL;


--
-- Name: communication_templates voice_agent_communication_templates_agent_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."communication_templates"
    ADD CONSTRAINT "voice_agent_communication_templates_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "lad_dev"."voice_agents"("id");


--
-- Name: communication_templates voice_agent_communication_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."communication_templates"
    ADD CONSTRAINT "voice_agent_communication_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id");


--
-- Name: voice_agent_numbers voice_agent_numbers_default_agent_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agent_numbers"
    ADD CONSTRAINT "voice_agent_numbers_default_agent_id_fkey" FOREIGN KEY ("default_agent_id") REFERENCES "lad_dev"."voice_agents"("id");


--
-- Name: voice_agent_numbers voice_agent_numbers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agent_numbers"
    ADD CONSTRAINT "voice_agent_numbers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id");


--
-- Name: voice_agent_voices voice_agent_voices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agent_voices"
    ADD CONSTRAINT "voice_agent_voices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id");


--
-- Name: voice_agents_backup_marked_for_deletion voice_agents_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agents_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_agents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "lad_dev"."users"("id");


--
-- Name: voice_agents_backup_marked_for_deletion voice_agents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agents_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_agents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id");


--
-- Name: voice_agents voice_agents_tenant_id_fkey1; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agents"
    ADD CONSTRAINT "voice_agents_tenant_id_fkey1" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id");


--
-- Name: voice_agents_backup_marked_for_deletion voice_agents_voice_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agents_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_agents_voice_id_fkey" FOREIGN KEY ("voice_id") REFERENCES "lad_dev"."voice_agent_voices"("id");


--
-- Name: voice_agents voice_agents_voice_id_fkey1; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_agents"
    ADD CONSTRAINT "voice_agents_voice_id_fkey1" FOREIGN KEY ("voice_id") REFERENCES "lad_dev"."voice_agent_voices"("id");


--
-- Name: voice_call_analysis voice_call_analysis_call_log_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_analysis"
    ADD CONSTRAINT "voice_call_analysis_call_log_id_fkey" FOREIGN KEY ("call_log_id") REFERENCES "lad_dev"."voice_call_logs"("id");


--
-- Name: voice_call_analysis voice_call_analysis_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_analysis"
    ADD CONSTRAINT "voice_call_analysis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id");


--
-- Name: voice_call_batch_entries voice_call_batch_entries_batch_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_batch_entries"
    ADD CONSTRAINT "voice_call_batch_entries_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "lad_dev"."voice_call_batches"("id") ON DELETE CASCADE;


--
-- Name: voice_call_batch_entries voice_call_batch_entries_call_log_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_batch_entries"
    ADD CONSTRAINT "voice_call_batch_entries_call_log_id_fkey" FOREIGN KEY ("call_log_id") REFERENCES "lad_dev"."voice_call_logs"("id");


--
-- Name: voice_call_batch_entries voice_call_batch_entries_lead_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_batch_entries"
    ADD CONSTRAINT "voice_call_batch_entries_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lad_dev"."leads"("id") ON DELETE SET NULL;


--
-- Name: voice_call_batch_entries voice_call_batch_entries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_batch_entries"
    ADD CONSTRAINT "voice_call_batch_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: voice_call_batches voice_call_batches_from_number_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_batches"
    ADD CONSTRAINT "voice_call_batches_from_number_id_fkey" FOREIGN KEY ("from_number_id") REFERENCES "lad_dev"."voice_numbers_marked_for_deletion"("id") ON DELETE SET NULL;


--
-- Name: voice_call_batches voice_call_batches_initiated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_batches"
    ADD CONSTRAINT "voice_call_batches_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "lad_dev"."users"("id") ON DELETE SET NULL;


--
-- Name: voice_call_batches voice_call_batches_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_batches"
    ADD CONSTRAINT "voice_call_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: voice_call_batches voice_call_batches_voice_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_batches"
    ADD CONSTRAINT "voice_call_batches_voice_id_fkey" FOREIGN KEY ("voice_id") REFERENCES "lad_dev"."voice_agent_voices"("id");


--
-- Name: voice_call_logs_backup_marked_for_deletion voice_call_logs_batch_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_call_logs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "lad_dev"."voice_call_batches"("id") ON DELETE SET NULL;


--
-- Name: voice_call_logs_backup_marked_for_deletion voice_call_logs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_call_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "lad_dev"."campaigns"("id") ON DELETE SET NULL;


--
-- Name: voice_call_logs_backup_marked_for_deletion voice_call_logs_campaign_lead_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_call_logs_campaign_lead_id_fkey" FOREIGN KEY ("campaign_lead_id") REFERENCES "lad_dev"."campaign_leads"("id") ON DELETE SET NULL;


--
-- Name: voice_call_logs_backup_marked_for_deletion voice_call_logs_campaign_step_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_call_logs_campaign_step_id_fkey" FOREIGN KEY ("campaign_step_id") REFERENCES "lad_dev"."campaign_steps"("id") ON DELETE SET NULL;


--
-- Name: voice_call_logs_backup_marked_for_deletion voice_call_logs_from_number_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_call_logs_from_number_id_fkey" FOREIGN KEY ("from_number_id") REFERENCES "lad_dev"."voice_numbers_marked_for_deletion"("id") ON DELETE SET NULL;


--
-- Name: voice_call_logs_backup_marked_for_deletion voice_call_logs_initiated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_call_logs_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "lad_dev"."users"("id") ON DELETE SET NULL;


--
-- Name: voice_call_logs_backup_marked_for_deletion voice_call_logs_lead_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_call_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lad_dev"."leads"("id") ON DELETE SET NULL;


--
-- Name: voice_call_logs_backup_marked_for_deletion voice_call_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_call_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: voice_call_logs_backup_marked_for_deletion voice_call_logs_voice_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_call_logs_backup_marked_for_deletion"
    ADD CONSTRAINT "voice_call_logs_voice_id_fkey" FOREIGN KEY ("voice_id") REFERENCES "lad_dev"."voice_provider_voices_marked_for_deletion"("id") ON DELETE SET NULL;


--
-- Name: voice_numbers_marked_for_deletion voice_numbers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_numbers_marked_for_deletion"
    ADD CONSTRAINT "voice_numbers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: voice_permissions voice_permissions_number_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_permissions"
    ADD CONSTRAINT "voice_permissions_number_id_fkey" FOREIGN KEY ("number_id") REFERENCES "lad_dev"."voice_numbers_marked_for_deletion"("id") ON DELETE CASCADE;


--
-- Name: voice_permissions voice_permissions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_permissions"
    ADD CONSTRAINT "voice_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: voice_permissions voice_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_permissions"
    ADD CONSTRAINT "voice_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lad_dev"."users"("id") ON DELETE CASCADE;


--
-- Name: voice_provider_voices_marked_for_deletion voice_provider_voices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_provider_voices_marked_for_deletion"
    ADD CONSTRAINT "voice_provider_voices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: voice_user_profiles voice_user_profiles_default_number_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_user_profiles"
    ADD CONSTRAINT "voice_user_profiles_default_number_id_fkey" FOREIGN KEY ("default_number_id") REFERENCES "lad_dev"."voice_numbers_marked_for_deletion"("id") ON DELETE SET NULL;


--
-- Name: voice_user_profiles voice_user_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_user_profiles"
    ADD CONSTRAINT "voice_user_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "lad_dev"."tenants"("id") ON DELETE CASCADE;


--
-- Name: voice_user_profiles voice_user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: lad_dev; Owner: -
--

ALTER TABLE ONLY "lad_dev"."voice_user_profiles"
    ADD CONSTRAINT "voice_user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lad_dev"."users"("id") ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict d0EHzZnwJ8TlBHuPKIZqk65DEuRmlfeJjpBzKJ4oespUJ8tCfEBDNkRY89LubyF

