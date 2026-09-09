--
-- Byblos test database schema snapshot
--
-- Generated from a fully-migrated local database (all 99 migration files
-- applied, verified via `node scripts/migrate.js` against a real Postgres
-- instance — see server/scripts/apply-test-schema.js for how this is used).
--
-- WHY A SNAPSHOT INSTEAD OF RUNNING ALL MIGRATIONS: the incremental migration
-- history includes at least one non-idempotent, environment-specific data
-- fix (20260902010000_reset_order8_fulfillment_job) and assumes prior manual
-- schema state in places, so it cannot reliably build a correct schema from
-- a completely empty database. This snapshot IS the source of truth for
-- CI/local test databases; the migrations/ directory remains the source of
-- truth for how production schema changes over time.
--
-- TO REGENERATE after adding new migrations: apply every migration in
-- migrations/ (in order) to a disposable local Postgres database, then run:
--   pg_dump --schema-only --no-owner --no-privileges --no-comments <db> > server/test/schema.sql.new
--   pg_dump --data-only --no-owner --table=pgmigrations --column-inserts <db> >> server/test/schema.sql.new
-- and replace this file (keep this header). Do not hand-edit the generated
-- sections below.
--
--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: event_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_status AS ENUM (
    'draft',
    'published',
    'cancelled',
    'completed'
);


--
-- Name: fulfillment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fulfillment_type AS ENUM (
    'BUYER_TO_SELLER',
    'COURIER',
    'SELLER_TO_BUYER',
    'DIGITAL'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'PENDING',
    'RESERVED',
    'HELD',
    'PAID',
    'PROCESSING',
    'COMPLETED',
    'CANCELLED',
    'FAILED',
    'EXPIRED',
    'COLLECTION_PENDING',
    'DELIVERY_PENDING',
    'SERVICE_PENDING',
    'CLIENT_PAYMENT_PENDING',
    'DEBT_PENDING',
    'DELIVERY_COMPLETE',
    'CONFIRMED',
    'CREATED',
    'PAYMENT_PENDING',
    'FULFILLMENT_PENDING',
    'FULFILLED',
    'DELIVERED',
    'BOOKED',
    'REFUND_PENDING',
    'REFUNDED',
    'COMPENSATION_REQUIRED',
    'AWAITING_SELLER_ACTION',
    'FULFILLING',
    'READY_FOR_BUYER',
    'MANUAL_REVIEW',
    'READY_FOR_PICKUP'
);


--
-- Name: order_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_type AS ENUM (
    'PHYSICAL',
    'SERVICE',
    'DIGITAL'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'mpesa',
    'card',
    'bank'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled',
    'success',
    'paid',
    'manual_review_required',
    'payment_mapping_failed',
    'compensation_required',
    'manual_review',
    'refunded'
);


--
-- Name: payout_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payout_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: product_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_status AS ENUM (
    'draft',
    'available',
    'sold'
);


--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_status AS ENUM (
    'pending',
    'paid',
    'cancelled',
    'refunded'
);


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'suspended',
    'inactive'
);


--
-- Name: alter_column_type_if_exists(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.alter_column_type_if_exists(p_table_name text, p_column_name text, p_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_sql text;
    v_column_exists boolean;
BEGIN
    -- Check if the column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = p_table_name 
        AND column_name = p_column_name
    ) INTO v_column_exists;
    
    IF v_column_exists THEN
        -- First, drop any constraints that might be using this column
        FOR v_sql IN 
            SELECT 'ALTER TABLE ' || table_name || ' DROP CONSTRAINT ' || constraint_name
            FROM information_schema.table_constraints 
            WHERE table_name = p_table_name
            AND constraint_type = 'CHECK'
            AND constraint_name LIKE p_table_name || '_' || p_column_name || '%'
        LOOP
            BEGIN
                EXECUTE v_sql;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not drop constraint: %', SQLERRM;
            END;
        END LOOP;
        
        -- Now alter the column type
        v_sql := format('ALTER TABLE %I ALTER COLUMN %I TYPE %s USING %I::%s', 
                       p_table_name, p_column_name, p_type, p_column_name, p_type);
        
        BEGIN
            EXECUTE v_sql;
            RAISE NOTICE 'Successfully altered % column in % table', p_column_name, p_table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not alter % column in % table: %', p_column_name, p_table_name, SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'Column %.% does not exist', p_table_name, p_column_name;
    END IF;
END;
$$;


--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    order_seq INTEGER;
    order_prefix VARCHAR(10) := 'ORD';
    order_date VARCHAR(8) := TO_CHAR(NOW(), 'YYYYMMDD');
BEGIN
    -- Serialize per-day order-number generation so MAX+1 is atomic under concurrent
    -- inserts. Transaction-scoped lock: released automatically at COMMIT, after this
    -- order row is committed and therefore visible to the next waiting transaction.
    PERFORM pg_advisory_xact_lock(hashtext('generate_order_number:' || order_date));

    SELECT COALESCE(MAX(SUBSTRING(order_number, 14)::INTEGER), 0) + 1 INTO order_seq
    FROM product_orders
    WHERE order_number LIKE order_prefix || '-' || order_date || '-%';

    NEW.order_number := order_prefix || '-' || order_date || '-' || LPAD(order_seq::TEXT, 6, '0');

    RETURN NEW;
END;
$$;


--
-- Name: generate_ticket_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_ticket_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    event_short_name VARCHAR(10);
    ticket_seq INTEGER;
BEGIN
    -- Get event short name (first 3 characters of event name, uppercase, no spaces)
    SELECT UPPER(REPLACE(SUBSTRING(name, 1, 3), ' ', '')) INTO event_short_name
    FROM events WHERE id = NEW.event_id;
    
    -- Get next sequence number for this event
    SELECT COALESCE(MAX(SUBSTRING(ticket_number, '\d+$')::INTEGER), 0) + 1 INTO ticket_seq
    FROM tickets
    WHERE event_id = NEW.event_id;
    
    -- Set the ticket number
    NEW.ticket_number := CONCAT('TKT-', event_short_name, '-', LPAD(ticket_seq::TEXT, 6, '0'));
    
    RETURN NEW;
END;
$_$;


-- handle_order_completion() + its handle_order_completion_trigger on
-- product_orders were deliberately OMITTED here (dropped from the live
-- schema by migrations/20260905140000_drop_legacy_order_completion_payout_trigger.sql).
-- This legacy trigger predated EscrowManager/settlement.service.js and raced
-- its `INSERT INTO payouts ... ON CONFLICT (order_id) DO NOTHING` idempotency
-- gate on every real order completion (an UPDATE, which this AFTER UPDATE OF
-- status trigger fired on) — the trigger's insert always landed first, so
-- EscrowManager always saw "already exists" and skipped crediting the
-- seller's pending_settlement_balance entirely. See that migration file for
-- the full account; a schema restored from this snapshot must not
-- reintroduce it.

--
-- Name: prevent_logistics_tracking_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_logistics_tracking_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'logistics_tracking_events are immutable';
END;
$$;


--
-- Name: process_scheduled_payouts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_scheduled_payouts() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Update payouts that are pending and their order's delivered_at is older than 24 hours
    UPDATE payouts p
    SET 
        status = 'processing',
        updated_at = NOW()
    FROM product_orders o
    WHERE p.order_id = o.id
    AND p.status = 'pending'
    AND o.status = 'delivered'
    AND o.updated_at < (NOW() - INTERVAL '24 hours')
    RETURNING p.*;
    
    -- Here you would add the actual payout processing logic
    -- For example, calling the payment provider's API to initiate the transfer
    -- For now, we'll just mark them as completed after a short delay
    
    -- Simulate processing delay
    PERFORM pg_sleep(5);
    
    -- Mark payouts as completed
    UPDATE payouts
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE status = 'processing';
    
    -- Update the order status to completed
    UPDATE product_orders o
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    FROM payouts p
    WHERE o.id = p.order_id
    AND p.status = 'completed'
    AND o.status = 'delivered';
END;
$$;


--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW; 
END;
$$;


--
-- Name: update_order_status_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_order_status_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Insert a new record into order_status_history when status changes
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_history (
            order_id,
            status,
            notes,
            created_by,
            created_by_type
        )
        VALUES (
            NEW.id,
            NEW.status::text,
            'Status changed from ' || COALESCE(OLD.status::TEXT, 'NULL') || ' to ' || NEW.status::TEXT,
            CASE
                WHEN TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'product_orders' AND TG_WHEN = 'AFTER'
                THEN current_setting('app.current_user_id', true)::INTEGER
                ELSE NULL
            END,
            CASE
                WHEN TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'product_orders' AND TG_WHEN = 'AFTER'
                THEN current_setting('app.current_user_type', true)
                ELSE 'system'
            END
        );
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: update_refund_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_refund_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_seller_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_seller_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_notifications (
    id bigint NOT NULL,
    recipient_user_id integer NOT NULL,
    recipient_role text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    channels text[] DEFAULT ARRAY['in_app'::text] NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_notifications_recipient_role_check CHECK ((recipient_role = ANY (ARRAY['buyer'::text, 'seller'::text, 'creator'::text, 'admin'::text, 'logistics'::text])))
);


--
-- Name: app_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_notifications_id_seq OWNED BY public.app_notifications.id;


--
-- Name: buyers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buyers (
    id integer NOT NULL,
    user_id integer,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    mobile_payment character varying(50) NOT NULL,
    whatsapp_number character varying(50),
    city character varying(100),
    location character varying(255),
    latitude numeric(10,8),
    longitude numeric(11,8),
    full_address text,
    terms_accepted boolean DEFAULT false,
    terms_accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    refund_withdrawal_reserved_balance numeric(15,2) DEFAULT 0 NOT NULL,
    is_member boolean DEFAULT false NOT NULL,
    member_number integer,
    membership_joined_at timestamp with time zone,
    refund_balance numeric(12,2) DEFAULT 0.00,
    membership_tier character varying(50) DEFAULT 'bronze'::character varying,
    refunds numeric(12,2) DEFAULT 0 NOT NULL,
    phone character varying(50),
    is_verified boolean DEFAULT false,
    verification_token character varying(255),
    verification_token_expires timestamp with time zone,
    last_login timestamp with time zone,
    CONSTRAINT buyers_refund_withdrawal_reserved_balance_check CHECK ((refund_withdrawal_reserved_balance >= (0)::numeric)),
    CONSTRAINT buyers_refunds_non_negative CHECK ((refunds >= (0)::numeric))
);


--
-- Name: buyers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.buyers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: buyers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.buyers_id_seq OWNED BY public.buyers.id;


--
-- Name: byblos_member_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.byblos_member_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creator_earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_earnings (
    id integer NOT NULL,
    creator_id integer NOT NULL,
    seller_id integer NOT NULL,
    seller_creator_link_id integer,
    order_id integer NOT NULL,
    payment_id integer,
    amount numeric(15,2) NOT NULL,
    rate numeric(6,4) NOT NULL,
    base_amount numeric(15,2) NOT NULL,
    status character varying(30) DEFAULT 'credited'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT creator_earnings_amount_non_negative CHECK ((amount >= (0)::numeric)),
    CONSTRAINT creator_earnings_base_amount_non_negative CHECK ((base_amount >= (0)::numeric))
);


--
-- Name: creator_earnings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creator_earnings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creator_earnings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creator_earnings_id_seq OWNED BY public.creator_earnings.id;


--
-- Name: creator_link_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_link_clicks (
    id integer NOT NULL,
    seller_creator_link_id integer NOT NULL,
    creator_id integer NOT NULL,
    seller_id integer NOT NULL,
    ip_address character varying(80),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: creator_link_clicks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creator_link_clicks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creator_link_clicks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creator_link_clicks_id_seq OWNED BY public.creator_link_clicks.id;


--
-- Name: creator_referral_earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_referral_earnings (
    id integer NOT NULL,
    referrer_creator_id integer NOT NULL,
    order_id integer NOT NULL,
    amount numeric(15,2) NOT NULL,
    units_sold integer DEFAULT 1 NOT NULL,
    status character varying(30) DEFAULT 'credited'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    referred_seller_id integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT creator_referral_earnings_amount_non_negative CHECK ((amount >= (0)::numeric))
);


--
-- Name: creator_referral_earnings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creator_referral_earnings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creator_referral_earnings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creator_referral_earnings_id_seq OWNED BY public.creator_referral_earnings.id;


--
-- Name: creator_shop_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_shop_requests (
    id integer NOT NULL,
    creator_id integer NOT NULL,
    seller_id integer NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: creator_shop_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creator_shop_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creator_shop_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creator_shop_requests_id_seq OWNED BY public.creator_shop_requests.id;


--
-- Name: creator_withdrawal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_withdrawal_requests (
    id integer NOT NULL,
    creator_id integer NOT NULL,
    amount numeric(15,2) NOT NULL,
    withdrawal_fee numeric(15,2) DEFAULT 0 NOT NULL,
    total_deducted numeric(15,2) DEFAULT 0 NOT NULL,
    mpesa_number character varying(50) NOT NULL,
    mpesa_name character varying(255) NOT NULL,
    status character varying(30) DEFAULT 'processing'::character varying NOT NULL,
    provider_reference character varying(255),
    idempotency_key character varying(120) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    processed_at timestamp with time zone
);


--
-- Name: creator_withdrawal_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creator_withdrawal_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creator_withdrawal_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creator_withdrawal_requests_id_seq OWNED BY public.creator_withdrawal_requests.id;


--
-- Name: creators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creators (
    id integer NOT NULL,
    user_id integer,
    first_name character varying(120) NOT NULL,
    last_name character varying(120) NOT NULL,
    email character varying(255) NOT NULL,
    mpesa_number character varying(50) NOT NULL,
    balance numeric(15,2) DEFAULT 0 NOT NULL,
    total_sales integer DEFAULT 0 NOT NULL,
    total_earnings numeric(15,2) DEFAULT 0 NOT NULL,
    referral_code character varying(24),
    total_referral_earnings numeric(15,2) DEFAULT 0 NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    whatsapp_number character varying(50),
    withdrawal_reserved_balance numeric(15,2) DEFAULT 0 NOT NULL,
    refund_withdrawal_reserved_balance numeric(15,2) DEFAULT 0 NOT NULL,
    instagram_link text,
    tiktok_link text,
    terms_accepted boolean DEFAULT false NOT NULL,
    terms_accepted_at timestamp with time zone,
    CONSTRAINT creators_balance_non_negative CHECK ((balance >= (0)::numeric)),
    CONSTRAINT creators_total_earnings_non_negative CHECK ((total_earnings >= (0)::numeric)),
    CONSTRAINT creators_total_referral_earnings_non_negative CHECK ((total_referral_earnings >= (0)::numeric)),
    CONSTRAINT creators_withdrawal_reserved_balance_check CHECK ((withdrawal_reserved_balance >= (0)::numeric))
);


--
-- Name: creators_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creators_id_seq OWNED BY public.creators.id;


--
-- Name: dashboard_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_stats (
    id integer NOT NULL,
    organizer_id integer NOT NULL,
    total_events integer DEFAULT 0 NOT NULL,
    upcoming_events integer DEFAULT 0 NOT NULL,
    past_events integer DEFAULT 0 NOT NULL,
    current_events integer DEFAULT 0 NOT NULL,
    total_tickets_sold integer DEFAULT 0 NOT NULL,
    total_revenue numeric(12,2) DEFAULT 0 NOT NULL,
    total_attendees integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: dashboard_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dashboard_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dashboard_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dashboard_stats_id_seq OWNED BY public.dashboard_stats.id;


--
-- Name: digital_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.digital_access (
    id integer NOT NULL,
    order_id integer NOT NULL,
    user_id integer,
    access_token character varying(255) NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    buyer_id integer
);


--
-- Name: digital_access_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.digital_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: digital_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.digital_access_id_seq OWNED BY public.digital_access.id;


--
-- Name: event_dedupe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_dedupe (
    event_id character varying(255) NOT NULL,
    event_name character varying(120) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: event_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_outbox (
    id bigint NOT NULL,
    event_id character varying(255) NOT NULL,
    event_name character varying(120) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    next_attempt_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp with time zone,
    delivery_attempts integer DEFAULT 0 NOT NULL,
    last_error_type character varying(40),
    final_failure_at timestamp with time zone
);


--
-- Name: event_outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.event_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.event_outbox_id_seq OWNED BY public.event_outbox.id;


--
-- Name: event_recipient_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_recipient_deliveries (
    id bigint NOT NULL,
    event_id character varying(255) NOT NULL,
    recipient_key character varying(255) NOT NULL,
    channel character varying(40) DEFAULT 'whatsapp'::character varying NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_error text,
    delivered_at timestamp with time zone,
    provider_message_id character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: event_recipient_deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.event_recipient_deliveries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_recipient_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.event_recipient_deliveries_id_seq OWNED BY public.event_recipient_deliveries.id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id integer NOT NULL,
    organizer_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    image_url text,
    location character varying(255) NOT NULL,
    ticket_quantity integer NOT NULL,
    ticket_price numeric(10,2) NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status public.event_status DEFAULT 'published'::public.event_status NOT NULL,
    withdrawal_status character varying(20) DEFAULT 'pending'::character varying,
    withdrawal_date timestamp with time zone,
    withdrawal_amount numeric(12,2),
    withdrawal_method character varying(50),
    withdrawal_details jsonb,
    CONSTRAINT events_withdrawal_status_check CHECK (((withdrawal_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('paid'::character varying)::text, ('withdrawn'::character varying)::text]))),
    CONSTRAINT valid_dates CHECK ((end_date > start_date))
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- Name: fraud_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fraud_events (
    id integer NOT NULL,
    payment_id integer,
    order_id integer,
    provider_reference character varying(255),
    event_type character varying(80) NOT NULL,
    expected_amount numeric(15,2),
    provider_amount numeric(15,2),
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: fraud_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fraud_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fraud_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fraud_events_id_seq OWNED BY public.fraud_events.id;


--
-- Name: fulfillment_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fulfillment_jobs (
    id integer NOT NULL,
    order_id integer NOT NULL,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 5,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    error_message text,
    last_attempt_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: fulfillment_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fulfillment_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fulfillment_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fulfillment_jobs_id_seq OWNED BY public.fulfillment_jobs.id;


--
-- Name: logistics_legs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logistics_legs (
    id bigint NOT NULL,
    logistics_request_id bigint NOT NULL,
    leg_type character varying(20) NOT NULL,
    payer character varying(20) NOT NULL,
    status character varying(40) DEFAULT 'payment_pending'::character varying NOT NULL,
    payment_id integer,
    fee_amount numeric(15,2) DEFAULT 0 NOT NULL,
    fee_currency character varying(10) DEFAULT 'KES'::character varying NOT NULL,
    distance_km numeric(10,2),
    origin_label character varying(160),
    origin_address text,
    origin_lat numeric(10,8),
    origin_lng numeric(11,8),
    destination_label character varying(160),
    destination_address text,
    destination_lat numeric(10,8),
    destination_lng numeric(11,8),
    deadline_at timestamp with time zone,
    assigned_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    failed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT logistics_legs_destination_lat_check CHECK (((destination_lat IS NULL) OR ((destination_lat >= ('-90'::integer)::numeric) AND (destination_lat <= (90)::numeric)))),
    CONSTRAINT logistics_legs_destination_lng_check CHECK (((destination_lng IS NULL) OR ((destination_lng >= ('-180'::integer)::numeric) AND (destination_lng <= (180)::numeric)))),
    CONSTRAINT logistics_legs_distance_km_check CHECK (((distance_km IS NULL) OR (distance_km >= (0)::numeric))),
    CONSTRAINT logistics_legs_fee_amount_check CHECK ((fee_amount >= (0)::numeric)),
    CONSTRAINT logistics_legs_leg_type_check CHECK (((leg_type)::text = ANY (ARRAY[('pickup'::character varying)::text, ('delivery'::character varying)::text]))),
    CONSTRAINT logistics_legs_origin_lat_check CHECK (((origin_lat IS NULL) OR ((origin_lat >= ('-90'::integer)::numeric) AND (origin_lat <= (90)::numeric)))),
    CONSTRAINT logistics_legs_origin_lng_check CHECK (((origin_lng IS NULL) OR ((origin_lng >= ('-180'::integer)::numeric) AND (origin_lng <= (180)::numeric)))),
    CONSTRAINT logistics_legs_payer_check CHECK (((payer)::text = ANY (ARRAY[('buyer'::character varying)::text, ('seller'::character varying)::text, ('platform'::character varying)::text]))),
    CONSTRAINT logistics_legs_status_check CHECK (((status)::text = ANY (ARRAY[('payment_pending'::character varying)::text, ('delivery_pending'::character varying)::text, ('pending'::character varying)::text, ('assigned'::character varying)::text, ('started'::character varying)::text, ('in_progress'::character varying)::text, ('picked_up'::character varying)::text, ('dropped_at_hub'::character varying)::text, ('out_for_delivery'::character varying)::text, ('completed'::character varying)::text, ('delivered'::character varying)::text, ('failed'::character varying)::text, ('delayed'::character varying)::text, ('cancelled'::character varying)::text])))
);


--
-- Name: logistics_legs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logistics_legs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logistics_legs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logistics_legs_id_seq OWNED BY public.logistics_legs.id;


--
-- Name: logistics_partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logistics_partners (
    id bigint NOT NULL,
    user_id integer,
    name character varying(160) NOT NULL,
    slug character varying(160) NOT NULL,
    email character varying(255),
    phone character varying(50),
    whatsapp_number character varying(50),
    active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: logistics_partners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logistics_partners_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logistics_partners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logistics_partners_id_seq OWNED BY public.logistics_partners.id;


--
-- Name: logistics_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logistics_requests (
    id bigint NOT NULL,
    order_id integer NOT NULL,
    partner_id bigint NOT NULL,
    package_code character varying(80),
    status character varying(40) DEFAULT 'pending'::character varying NOT NULL,
    service_level character varying(40) DEFAULT 'standard'::character varying NOT NULL,
    deadline_at timestamp with time zone,
    completed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT logistics_requests_status_check CHECK (((status)::text = ANY (ARRAY[('not_required'::character varying)::text, ('pending'::character varying)::text, ('awaiting_seller_choice'::character varying)::text, ('payment_pending'::character varying)::text, ('active'::character varying)::text, ('in_progress'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text, ('failed'::character varying)::text, ('manual_review'::character varying)::text])))
);


--
-- Name: logistics_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logistics_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logistics_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logistics_requests_id_seq OWNED BY public.logistics_requests.id;


--
-- Name: logistics_tracking_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logistics_tracking_events (
    id bigint NOT NULL,
    logistics_request_id bigint NOT NULL,
    logistics_leg_id bigint,
    event_key character varying(255),
    event_type character varying(80) NOT NULL,
    status character varying(40) NOT NULL,
    message text,
    source character varying(40) DEFAULT 'system'::character varying NOT NULL,
    actor_user_id integer,
    actor_label character varying(160),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT logistics_tracking_events_source_check CHECK (((source)::text = ANY (ARRAY[('system'::character varying)::text, ('mzigo'::character varying)::text, ('admin'::character varying)::text, ('buyer'::character varying)::text, ('seller'::character varying)::text])))
);


--
-- Name: logistics_tracking_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logistics_tracking_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logistics_tracking_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logistics_tracking_events_id_seq OWNED BY public.logistics_tracking_events.id;


--
-- Name: logistics_tracking_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logistics_tracking_links (
    id bigint NOT NULL,
    logistics_request_id bigint NOT NULL,
    audience character varying(20) NOT NULL,
    public_id character varying(64) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT logistics_tracking_links_audience_check CHECK (((audience)::text = ANY (ARRAY[('buyer'::character varying)::text, ('seller'::character varying)::text])))
);


--
-- Name: logistics_tracking_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logistics_tracking_links_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logistics_tracking_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logistics_tracking_links_id_seq OWNED BY public.logistics_tracking_links.id;


--
-- Name: notification_device_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_device_tokens (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    role text NOT NULL,
    platform text NOT NULL,
    token text NOT NULL,
    device_id text,
    app_version text,
    is_active boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_device_tokens_platform_check CHECK ((platform = ANY (ARRAY['android'::text, 'ios'::text, 'web'::text]))),
    CONSTRAINT notification_device_tokens_role_check CHECK ((role = ANY (ARRAY['buyer'::text, 'seller'::text, 'creator'::text, 'admin'::text, 'logistics'::text])))
);


--
-- Name: notification_device_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_device_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_device_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_device_tokens_id_seq OWNED BY public.notification_device_tokens.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer,
    product_id integer,
    name character varying(255) NOT NULL,
    price numeric(15,2) NOT NULL,
    quantity integer NOT NULL,
    subtotal numeric(15,2) NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    product_name character varying(255),
    product_price numeric(15,2),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT chk_subtotal_positive CHECK ((subtotal >= (0)::numeric))
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    id integer NOT NULL,
    order_id integer NOT NULL,
    status character varying(50) NOT NULL,
    notes text,
    created_by integer,
    created_by_type character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: order_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_status_history_id_seq OWNED BY public.order_status_history.id;


--
-- Name: organizers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizers (
    id integer NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    is_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp with time zone,
    reset_password_token character varying(255),
    reset_password_expires timestamp with time zone,
    password_reset_token character varying(255),
    password_reset_expires timestamp with time zone
);


--
-- Name: organizers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizers_id_seq OWNED BY public.organizers.id;


--
-- Name: payment_provider_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_provider_attempts (
    id integer NOT NULL,
    payment_id integer NOT NULL,
    order_id integer,
    api_ref character varying(160) NOT NULL,
    idempotency_key character varying(160),
    provider_reference character varying(255),
    status character varying(40) DEFAULT 'provider_call_pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    request_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    response_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_attempt_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: payment_provider_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_provider_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_provider_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_provider_attempts_id_seq OWNED BY public.payment_provider_attempts.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    invoice_id character varying(100) NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'KES'::character varying,
    status public.payment_status DEFAULT 'pending'::public.payment_status,
    payment_method character varying(50) DEFAULT 'payd'::character varying,
    mobile_payment character varying(50),
    whatsapp_number character varying(50),
    email character varying(255),
    metadata jsonb,
    provider_reference character varying(255),
    api_ref character varying(255),
    mpesa_receipt character varying(50),
    raw_response jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    order_id integer
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: payout_provider_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout_provider_attempts (
    id integer NOT NULL,
    withdrawal_request_id integer NOT NULL,
    seller_id integer,
    idempotency_key character varying(160) NOT NULL,
    provider_reference character varying(255),
    status character varying(40) DEFAULT 'provider_call_pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    request_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    response_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_attempt_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    creator_id integer,
    buyer_id integer
);


--
-- Name: payout_provider_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payout_provider_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payout_provider_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payout_provider_attempts_id_seq OWNED BY public.payout_provider_attempts.id;


--
-- Name: payout_reconciliation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout_reconciliation_events (
    id bigint NOT NULL,
    withdrawal_request_id integer,
    seller_id integer,
    event_type character varying(100) NOT NULL,
    provider_reference character varying(255),
    client_reference character varying(160),
    reference_key character varying(255) NOT NULL,
    amount numeric(15,2),
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    creator_id integer,
    buyer_id integer
);


--
-- Name: payout_reconciliation_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payout_reconciliation_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payout_reconciliation_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payout_reconciliation_events_id_seq OWNED BY public.payout_reconciliation_events.id;


--
-- Name: payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payouts (
    id integer NOT NULL,
    seller_id integer,
    order_id integer,
    payment_id integer,
    amount numeric(15,2) NOT NULL,
    platform_fee numeric(15,2) DEFAULT 0 NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    payment_method character varying(50),
    processed_at timestamp with time zone,
    completed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    available_at timestamp with time zone,
    settled_at timestamp with time zone,
    settlement_status character varying(30) DEFAULT 'settled'::character varying NOT NULL,
    settlement_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    payout_method character varying(50) DEFAULT 'bank_transfer'::character varying NOT NULL,
    reference_number character varying(100),
    notes text,
    CONSTRAINT payouts_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT payouts_amount_non_negative CHECK ((amount >= (0)::numeric)),
    CONSTRAINT payouts_platform_fee_check CHECK ((platform_fee >= (0)::numeric))
);


--
-- Name: payouts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payouts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payouts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payouts_id_seq OWNED BY public.payouts.id;


--
-- Name: pending_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_registrations (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50),
    registration_data jsonb,
    physical_address text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    verification_token character varying(255),
    expires_at timestamp with time zone NOT NULL,
    terms_accepted boolean DEFAULT false,
    terms_accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pending_registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pending_registrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pending_registrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pending_registrations_id_seq OWNED BY public.pending_registrations.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: product_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_orders (
    id integer NOT NULL,
    order_number character varying(50) NOT NULL,
    buyer_id integer,
    seller_id integer,
    total_amount numeric(15,2) NOT NULL,
    platform_fee_amount numeric(15,2) NOT NULL,
    seller_payout_amount numeric(15,2) NOT NULL,
    payment_method character varying(50) DEFAULT 'payd'::character varying,
    buyer_name character varying(255),
    buyer_email character varying(255),
    buyer_mobile_payment character varying(50),
    buyer_whatsapp_number character varying(50),
    shipping_address text,
    notes text,
    metadata jsonb,
    status character varying(50) DEFAULT 'PENDING'::character varying,
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status,
    service_requirements text,
    fulfillment_type public.fulfillment_type DEFAULT 'BUYER_TO_SELLER'::public.fulfillment_type,
    delivery_location jsonb,
    order_type public.order_type DEFAULT 'PHYSICAL'::public.order_type,
    total_quantity integer DEFAULT 1,
    reservation_expires_at timestamp with time zone,
    location_address text,
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    service_title text,
    notification_sent boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    client_checkout_token character varying(160) NOT NULL,
    custom_production_deadline_at timestamp with time zone,
    custom_production_grace_deadline_at timestamp with time zone,
    custom_production_reminder_sent_at timestamp with time zone,
    auto_cancelled_reason text,
    seller_dropoff_deadline timestamp with time zone,
    buyer_pickup_deadline timestamp with time zone,
    ready_for_pickup_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    pre_handoff_sla jsonb,
    paid_at timestamp with time zone,
    is_debt boolean DEFAULT false NOT NULL,
    is_seller_initiated boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    payment_reference character varying(255),
    payment_completed_at timestamp with time zone,
    CONSTRAINT product_orders_platform_fee_amount_non_negative CHECK ((platform_fee_amount >= (0)::numeric)),
    CONSTRAINT product_orders_seller_payout_amount_non_negative CHECK ((seller_payout_amount >= (0)::numeric)),
    CONSTRAINT product_orders_total_amount_non_negative CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: product_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_orders_id_seq OWNED BY public.product_orders.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    seller_id integer,
    name character varying(255) NOT NULL,
    price numeric(15,2) NOT NULL,
    description text,
    image_url text,
    images jsonb,
    aesthetic character varying(50),
    status character varying(20) DEFAULT 'available'::character varying,
    product_type character varying(20) DEFAULT 'physical'::character varying,
    is_digital boolean DEFAULT false,
    digital_file_path text,
    digital_file_name text,
    digital_file_size integer,
    service_locations jsonb,
    service_options jsonb,
    track_inventory boolean DEFAULT false,
    quantity integer DEFAULT 0,
    reserved_quantity integer DEFAULT 0,
    low_stock_threshold integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_custom_product boolean DEFAULT false NOT NULL,
    production_days integer,
    customization_prompt text,
    is_imported_product boolean DEFAULT false NOT NULL,
    import_days integer,
    import_note text,
    sold_at timestamp with time zone,
    is_sold boolean DEFAULT false,
    CONSTRAINT check_quantity_positive CHECK ((quantity >= 0)),
    CONSTRAINT check_reserved_quantity_positive CHECK ((reserved_quantity >= 0)),
    CONSTRAINT products_custom_production_days_check CHECK ((((is_custom_product = false) AND (production_days IS NULL) AND (customization_prompt IS NULL)) OR (((product_type)::text = 'physical'::text) AND (is_custom_product = true) AND ((production_days >= 1) AND (production_days <= 5))))),
    CONSTRAINT products_import_days_check CHECK (((is_imported_product = false) OR (((product_type)::text = 'physical'::text) AND (import_days = ANY (ARRAY[7, 14, 21, 30])))))
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: promo_code_uses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_code_uses (
    id integer NOT NULL,
    promo_code_id integer NOT NULL,
    ticket_id integer,
    customer_email character varying(255) NOT NULL,
    discount_amount numeric(10,2) NOT NULL,
    original_price numeric(10,2) NOT NULL,
    final_price numeric(10,2) NOT NULL,
    used_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: promo_code_uses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_code_uses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_code_uses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_code_uses_id_seq OWNED BY public.promo_code_uses.id;


--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_codes (
    id integer NOT NULL,
    event_id integer NOT NULL,
    organizer_id integer NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    discount_type character varying(20) DEFAULT 'percentage'::character varying NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    min_purchase_amount numeric(10,2) DEFAULT 0,
    valid_from timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT promo_codes_discount_type_check CHECK (((discount_type)::text = ANY (ARRAY[('percentage'::character varying)::text, ('fixed'::character varying)::text]))),
    CONSTRAINT promo_codes_discount_value_check CHECK ((discount_value > (0)::numeric)),
    CONSTRAINT valid_dates CHECK (((valid_until IS NULL) OR (valid_until > valid_from))),
    CONSTRAINT valid_discount_percentage CHECK (((((discount_type)::text = 'percentage'::text) AND (discount_value <= (100)::numeric) AND (discount_value > (0)::numeric)) OR ((discount_type)::text = 'fixed'::text)))
);


--
-- Name: promo_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_codes_id_seq OWNED BY public.promo_codes.id;


--
-- Name: recent_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recent_events (
    id integer NOT NULL,
    organizer_id integer NOT NULL,
    event_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: recent_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recent_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recent_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recent_events_id_seq OWNED BY public.recent_events.id;


--
-- Name: recent_sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recent_sales (
    id integer NOT NULL,
    organizer_id integer NOT NULL,
    transaction_id character varying(100) NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255) NOT NULL,
    event_id integer,
    ticket_type character varying(100) NOT NULL,
    quantity integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    status character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: recent_sales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recent_sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recent_sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recent_sales_id_seq OWNED BY public.recent_sales.id;


--
-- Name: referral_earnings_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_earnings_log (
    id integer NOT NULL,
    referrer_seller_id integer NOT NULL,
    referred_seller_id integer NOT NULL,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    referred_gmv numeric(15,2) DEFAULT 0 NOT NULL,
    reward_amount numeric(15,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    referred_units_sold integer DEFAULT 0 NOT NULL,
    CONSTRAINT referral_earnings_log_period_month_check CHECK (((period_month >= 1) AND (period_month <= 12))),
    CONSTRAINT referral_earnings_log_period_year_check CHECK ((period_year >= 2020))
);


--
-- Name: referral_earnings_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referral_earnings_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referral_earnings_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referral_earnings_log_id_seq OWNED BY public.referral_earnings_log.id;


--
-- Name: refund_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_requests (
    id integer NOT NULL,
    buyer_id integer,
    amount numeric(15,2) NOT NULL,
    payment_method character varying(50),
    payment_details jsonb DEFAULT '{}'::jsonb,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    admin_notes text,
    processed_by integer,
    processed_at timestamp with time zone,
    requested_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    order_id integer,
    notes text,
    CONSTRAINT refund_requests_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'completed'::character varying, 'manual_review'::character varying])::text[])))
);


--
-- Name: refund_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refund_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refund_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refund_requests_id_seq OWNED BY public.refund_requests.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_id integer,
    permission_id integer
);


--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    slug character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: seller_creator_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_creator_invites (
    id integer NOT NULL,
    seller_id integer NOT NULL,
    email character varying(255) NOT NULL,
    invite_token character varying(96) NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    invited_by_user_id integer,
    accepted_creator_id integer,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: seller_creator_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seller_creator_invites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seller_creator_invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seller_creator_invites_id_seq OWNED BY public.seller_creator_invites.id;


--
-- Name: seller_creator_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_creator_links (
    id integer NOT NULL,
    seller_id integer NOT NULL,
    creator_id integer NOT NULL,
    code character varying(32) NOT NULL,
    commission_rate numeric(6,4) DEFAULT 0.0100 NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    click_count integer DEFAULT 0 NOT NULL
);


--
-- Name: seller_creator_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seller_creator_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seller_creator_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seller_creator_links_id_seq OWNED BY public.seller_creator_links.id;


--
-- Name: seller_knocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_knocks (
    id bigint NOT NULL,
    seller_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seller_knocks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seller_knocks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seller_knocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seller_knocks_id_seq OWNED BY public.seller_knocks.id;


--
-- Name: sellers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sellers (
    id integer NOT NULL,
    user_id integer,
    full_name character varying(255) NOT NULL,
    shop_name character varying(255) NOT NULL,
    slug character varying(255),
    email character varying(255) NOT NULL,
    whatsapp_number character varying(50),
    city character varying(100),
    location character varying(255),
    physical_address text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    theme character varying(50),
    total_sales numeric(15,2) DEFAULT 0 NOT NULL,
    net_revenue numeric(15,2) DEFAULT 0 NOT NULL,
    instagram_link text,
    tiktok_link text,
    facebook_link text,
    terms_accepted boolean DEFAULT false,
    terms_accepted_at timestamp with time zone,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    referral_code character varying(16),
    referred_by_seller_id integer,
    referral_active_until timestamp with time zone,
    total_referral_earnings numeric(15,2) DEFAULT 0,
    bio text,
    avatar_url text,
    referred_by_creator_id integer,
    creator_commission_rate numeric(6,4) DEFAULT 0.0100 NOT NULL,
    pending_settlement_balance numeric(15,2) DEFAULT 0 NOT NULL,
    withdrawal_reserved_balance numeric(15,2) DEFAULT 0 NOT NULL,
    refund_reserved_balance numeric(15,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true,
    creator_commission_pct numeric(5,2) DEFAULT 0.00,
    password_reset_token character varying(255),
    password_reset_expires timestamp with time zone,
    balance numeric(12,2) DEFAULT 0.00 NOT NULL,
    is_creator_marketplace_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT sellers_balance_non_negative CHECK ((balance >= (0)::numeric)),
    CONSTRAINT sellers_creator_commission_rate_range CHECK (((creator_commission_rate >= 0.0100) AND (creator_commission_rate <= 1.0000))),
    CONSTRAINT sellers_pending_settlement_balance_check CHECK ((pending_settlement_balance >= (0)::numeric)),
    CONSTRAINT sellers_pending_settlement_balance_non_negative CHECK ((pending_settlement_balance >= (0)::numeric)),
    CONSTRAINT sellers_refund_reserved_balance_check CHECK ((refund_reserved_balance >= (0)::numeric)),
    CONSTRAINT sellers_refund_reserved_balance_non_negative CHECK ((refund_reserved_balance >= (0)::numeric)),
    CONSTRAINT sellers_withdrawal_reserved_balance_check CHECK ((withdrawal_reserved_balance >= (0)::numeric)),
    CONSTRAINT sellers_withdrawal_reserved_balance_non_negative CHECK ((withdrawal_reserved_balance >= (0)::numeric))
);


--
-- Name: sellers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sellers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sellers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sellers_id_seq OWNED BY public.sellers.id;


--
-- Name: service_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_slots (
    id integer NOT NULL,
    service_id integer NOT NULL,
    time_slot timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'AVAILABLE'::character varying NOT NULL,
    reserved_by_order_id integer,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_slots_id_seq OWNED BY public.service_slots.id;


--
-- Name: system_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_issues (
    id integer NOT NULL,
    order_id integer,
    issue_type character varying(50) NOT NULL,
    severity character varying(20) DEFAULT 'MEDIUM'::character varying,
    resolved boolean DEFAULT false,
    details jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: system_issues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_issues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_issues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_issues_id_seq OWNED BY public.system_issues.id;


--
-- Name: ticket_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_types (
    id integer NOT NULL,
    event_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    quantity integer NOT NULL,
    sales_start_date timestamp with time zone,
    sales_end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_price CHECK ((price >= (0)::numeric)),
    CONSTRAINT valid_quantity CHECK ((quantity >= 0)),
    CONSTRAINT valid_sales_period CHECK (((sales_end_date IS NULL) OR (sales_start_date IS NULL) OR (sales_end_date > sales_start_date)))
);


--
-- Name: ticket_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_types_id_seq OWNED BY public.ticket_types.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    ticket_number character varying(50) NOT NULL,
    event_id integer NOT NULL,
    organizer_id integer NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255) NOT NULL,
    ticket_type_id integer,
    ticket_type_name character varying(100) NOT NULL,
    price numeric(10,2) NOT NULL,
    status public.ticket_status DEFAULT 'pending'::public.ticket_status NOT NULL,
    scanned boolean DEFAULT false,
    scanned_at timestamp with time zone,
    unit_price numeric(10,2) DEFAULT 0 NOT NULL,
    total_price numeric(10,2) DEFAULT 0 NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: user_digital_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_digital_access (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL,
    order_id integer NOT NULL,
    granted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_digital_access_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_digital_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_digital_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_digital_access_id_seq OWNED BY public.user_digital_access.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    user_id integer,
    role_id integer
);


--
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50),
    is_verified boolean DEFAULT false,
    password_changed_at timestamp with time zone,
    last_login timestamp with time zone,
    reset_password_token character varying(255),
    reset_password_expires timestamp with time zone,
    email_verification_token character varying(255),
    email_verification_expires timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: webhook_replay_dedupe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_replay_dedupe (
    event_id character varying(255) NOT NULL,
    event_type character varying(160) NOT NULL,
    provider_reference character varying(255),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(30) DEFAULT 'processing'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    last_error text
);


--
-- Name: wishlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist (
    id integer NOT NULL,
    buyer_id integer NOT NULL,
    product_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: wishlist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wishlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wishlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wishlist_id_seq OWNED BY public.wishlist.id;


--
-- Name: wishlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlists (
    id integer NOT NULL,
    user_id integer,
    buyer_id integer,
    product_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: wishlists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wishlists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wishlists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wishlists_id_seq OWNED BY public.wishlists.id;


--
-- Name: withdrawal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawal_requests (
    id integer NOT NULL,
    seller_id integer,
    amount numeric(15,2) NOT NULL,
    mpesa_number character varying(50) NOT NULL,
    mpesa_name character varying(255) NOT NULL,
    status character varying(30) DEFAULT 'processing'::character varying NOT NULL,
    provider_reference character varying(255),
    mpesa_receipt character varying(80),
    raw_response jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    api_call_pending boolean DEFAULT false,
    idempotency_key character varying(120) NOT NULL,
    processed_at timestamp with time zone,
    processed_by character varying(120),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    retry_started_at timestamp with time zone,
    retry_worker_id character varying(120),
    creator_id integer,
    buyer_id integer,
    CONSTRAINT withdrawal_requests_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT withdrawal_requests_one_entity_check CHECK ((((seller_id IS NOT NULL) AND (creator_id IS NULL) AND (buyer_id IS NULL)) OR ((seller_id IS NULL) AND (creator_id IS NOT NULL) AND (buyer_id IS NULL)) OR ((seller_id IS NULL) AND (creator_id IS NULL) AND (buyer_id IS NOT NULL))))
);


--
-- Name: withdrawal_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.withdrawal_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: withdrawal_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.withdrawal_requests_id_seq OWNED BY public.withdrawal_requests.id;


--
-- Name: app_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_notifications ALTER COLUMN id SET DEFAULT nextval('public.app_notifications_id_seq'::regclass);


--
-- Name: buyers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyers ALTER COLUMN id SET DEFAULT nextval('public.buyers_id_seq'::regclass);


--
-- Name: creator_earnings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_earnings ALTER COLUMN id SET DEFAULT nextval('public.creator_earnings_id_seq'::regclass);


--
-- Name: creator_link_clicks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_link_clicks ALTER COLUMN id SET DEFAULT nextval('public.creator_link_clicks_id_seq'::regclass);


--
-- Name: creator_referral_earnings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_referral_earnings ALTER COLUMN id SET DEFAULT nextval('public.creator_referral_earnings_id_seq'::regclass);


--
-- Name: creator_shop_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_shop_requests ALTER COLUMN id SET DEFAULT nextval('public.creator_shop_requests_id_seq'::regclass);


--
-- Name: creator_withdrawal_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_withdrawal_requests ALTER COLUMN id SET DEFAULT nextval('public.creator_withdrawal_requests_id_seq'::regclass);


--
-- Name: creators id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creators ALTER COLUMN id SET DEFAULT nextval('public.creators_id_seq'::regclass);


--
-- Name: dashboard_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_stats ALTER COLUMN id SET DEFAULT nextval('public.dashboard_stats_id_seq'::regclass);


--
-- Name: digital_access id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_access ALTER COLUMN id SET DEFAULT nextval('public.digital_access_id_seq'::regclass);


--
-- Name: event_outbox id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox ALTER COLUMN id SET DEFAULT nextval('public.event_outbox_id_seq'::regclass);


--
-- Name: event_recipient_deliveries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_recipient_deliveries ALTER COLUMN id SET DEFAULT nextval('public.event_recipient_deliveries_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- Name: fraud_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_events ALTER COLUMN id SET DEFAULT nextval('public.fraud_events_id_seq'::regclass);


--
-- Name: fulfillment_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_jobs ALTER COLUMN id SET DEFAULT nextval('public.fulfillment_jobs_id_seq'::regclass);


--
-- Name: logistics_legs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_legs ALTER COLUMN id SET DEFAULT nextval('public.logistics_legs_id_seq'::regclass);


--
-- Name: logistics_partners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_partners ALTER COLUMN id SET DEFAULT nextval('public.logistics_partners_id_seq'::regclass);


--
-- Name: logistics_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_requests ALTER COLUMN id SET DEFAULT nextval('public.logistics_requests_id_seq'::regclass);


--
-- Name: logistics_tracking_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_tracking_events ALTER COLUMN id SET DEFAULT nextval('public.logistics_tracking_events_id_seq'::regclass);


--
-- Name: logistics_tracking_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_tracking_links ALTER COLUMN id SET DEFAULT nextval('public.logistics_tracking_links_id_seq'::regclass);


--
-- Name: notification_device_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_device_tokens ALTER COLUMN id SET DEFAULT nextval('public.notification_device_tokens_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: order_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history ALTER COLUMN id SET DEFAULT nextval('public.order_status_history_id_seq'::regclass);


--
-- Name: organizers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizers ALTER COLUMN id SET DEFAULT nextval('public.organizers_id_seq'::regclass);


--
-- Name: payment_provider_attempts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_provider_attempts ALTER COLUMN id SET DEFAULT nextval('public.payment_provider_attempts_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: payout_provider_attempts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_provider_attempts ALTER COLUMN id SET DEFAULT nextval('public.payout_provider_attempts_id_seq'::regclass);


--
-- Name: payout_reconciliation_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_reconciliation_events ALTER COLUMN id SET DEFAULT nextval('public.payout_reconciliation_events_id_seq'::regclass);


--
-- Name: payouts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts ALTER COLUMN id SET DEFAULT nextval('public.payouts_id_seq'::regclass);


--
-- Name: pending_registrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_registrations ALTER COLUMN id SET DEFAULT nextval('public.pending_registrations_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: product_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_orders ALTER COLUMN id SET DEFAULT nextval('public.product_orders_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: promo_code_uses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses ALTER COLUMN id SET DEFAULT nextval('public.promo_code_uses_id_seq'::regclass);


--
-- Name: promo_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes ALTER COLUMN id SET DEFAULT nextval('public.promo_codes_id_seq'::regclass);


--
-- Name: recent_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_events ALTER COLUMN id SET DEFAULT nextval('public.recent_events_id_seq'::regclass);


--
-- Name: recent_sales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_sales ALTER COLUMN id SET DEFAULT nextval('public.recent_sales_id_seq'::regclass);


--
-- Name: referral_earnings_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_earnings_log ALTER COLUMN id SET DEFAULT nextval('public.referral_earnings_log_id_seq'::regclass);


--
-- Name: refund_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests ALTER COLUMN id SET DEFAULT nextval('public.refund_requests_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: seller_creator_invites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_invites ALTER COLUMN id SET DEFAULT nextval('public.seller_creator_invites_id_seq'::regclass);


--
-- Name: seller_creator_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_links ALTER COLUMN id SET DEFAULT nextval('public.seller_creator_links_id_seq'::regclass);


--
-- Name: seller_knocks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_knocks ALTER COLUMN id SET DEFAULT nextval('public.seller_knocks_id_seq'::regclass);


--
-- Name: sellers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellers ALTER COLUMN id SET DEFAULT nextval('public.sellers_id_seq'::regclass);


--
-- Name: service_slots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_slots ALTER COLUMN id SET DEFAULT nextval('public.service_slots_id_seq'::regclass);


--
-- Name: system_issues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_issues ALTER COLUMN id SET DEFAULT nextval('public.system_issues_id_seq'::regclass);


--
-- Name: ticket_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_types ALTER COLUMN id SET DEFAULT nextval('public.ticket_types_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: user_digital_access id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_digital_access ALTER COLUMN id SET DEFAULT nextval('public.user_digital_access_id_seq'::regclass);


--
-- Name: user_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wishlist id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist ALTER COLUMN id SET DEFAULT nextval('public.wishlist_id_seq'::regclass);


--
-- Name: wishlists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists ALTER COLUMN id SET DEFAULT nextval('public.wishlists_id_seq'::regclass);


--
-- Name: withdrawal_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests ALTER COLUMN id SET DEFAULT nextval('public.withdrawal_requests_id_seq'::regclass);


--
-- Name: app_notifications app_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_notifications
    ADD CONSTRAINT app_notifications_pkey PRIMARY KEY (id);


--
-- Name: buyers buyers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyers
    ADD CONSTRAINT buyers_pkey PRIMARY KEY (id);


--
-- Name: creator_earnings creator_earnings_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_order_id_key UNIQUE (order_id);


--
-- Name: creator_earnings creator_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_pkey PRIMARY KEY (id);


--
-- Name: creator_link_clicks creator_link_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_link_clicks
    ADD CONSTRAINT creator_link_clicks_pkey PRIMARY KEY (id);


--
-- Name: creator_referral_earnings creator_referral_earnings_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_referral_earnings
    ADD CONSTRAINT creator_referral_earnings_order_id_key UNIQUE (order_id);


--
-- Name: creator_referral_earnings creator_referral_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_referral_earnings
    ADD CONSTRAINT creator_referral_earnings_pkey PRIMARY KEY (id);


--
-- Name: creator_shop_requests creator_shop_requests_creator_id_seller_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_shop_requests
    ADD CONSTRAINT creator_shop_requests_creator_id_seller_id_key UNIQUE (creator_id, seller_id);


--
-- Name: creator_shop_requests creator_shop_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_shop_requests
    ADD CONSTRAINT creator_shop_requests_pkey PRIMARY KEY (id);


--
-- Name: creator_withdrawal_requests creator_withdrawal_requests_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_withdrawal_requests
    ADD CONSTRAINT creator_withdrawal_requests_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: creator_withdrawal_requests creator_withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_withdrawal_requests
    ADD CONSTRAINT creator_withdrawal_requests_pkey PRIMARY KEY (id);


--
-- Name: creators creators_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creators
    ADD CONSTRAINT creators_email_key UNIQUE (email);


--
-- Name: creators creators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creators
    ADD CONSTRAINT creators_pkey PRIMARY KEY (id);


--
-- Name: creators creators_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creators
    ADD CONSTRAINT creators_referral_code_key UNIQUE (referral_code);


--
-- Name: creators creators_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creators
    ADD CONSTRAINT creators_user_id_key UNIQUE (user_id);


--
-- Name: dashboard_stats dashboard_stats_organizer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_stats
    ADD CONSTRAINT dashboard_stats_organizer_id_key UNIQUE (organizer_id);


--
-- Name: dashboard_stats dashboard_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_stats
    ADD CONSTRAINT dashboard_stats_pkey PRIMARY KEY (id);


--
-- Name: digital_access digital_access_access_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_access
    ADD CONSTRAINT digital_access_access_token_key UNIQUE (access_token);


--
-- Name: digital_access digital_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_access
    ADD CONSTRAINT digital_access_pkey PRIMARY KEY (id);


--
-- Name: event_dedupe event_dedupe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_dedupe
    ADD CONSTRAINT event_dedupe_pkey PRIMARY KEY (event_id);


--
-- Name: event_outbox event_outbox_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox
    ADD CONSTRAINT event_outbox_event_id_key UNIQUE (event_id);


--
-- Name: event_outbox event_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox
    ADD CONSTRAINT event_outbox_pkey PRIMARY KEY (id);


--
-- Name: event_recipient_deliveries event_recipient_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_recipient_deliveries
    ADD CONSTRAINT event_recipient_deliveries_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: fraud_events fraud_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_events
    ADD CONSTRAINT fraud_events_pkey PRIMARY KEY (id);


--
-- Name: fulfillment_jobs fulfillment_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_jobs
    ADD CONSTRAINT fulfillment_jobs_pkey PRIMARY KEY (id);


--
-- Name: logistics_legs logistics_legs_id_request_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_legs
    ADD CONSTRAINT logistics_legs_id_request_unique UNIQUE (id, logistics_request_id);


--
-- Name: logistics_legs logistics_legs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_legs
    ADD CONSTRAINT logistics_legs_pkey PRIMARY KEY (id);


--
-- Name: logistics_legs logistics_legs_request_leg_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_legs
    ADD CONSTRAINT logistics_legs_request_leg_type_unique UNIQUE (logistics_request_id, leg_type);


--
-- Name: logistics_partners logistics_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_partners
    ADD CONSTRAINT logistics_partners_pkey PRIMARY KEY (id);


--
-- Name: logistics_requests logistics_requests_order_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_requests
    ADD CONSTRAINT logistics_requests_order_id_unique UNIQUE (order_id);


--
-- Name: logistics_requests logistics_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_requests
    ADD CONSTRAINT logistics_requests_pkey PRIMARY KEY (id);


--
-- Name: logistics_tracking_events logistics_tracking_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_tracking_events
    ADD CONSTRAINT logistics_tracking_events_pkey PRIMARY KEY (id);


--
-- Name: logistics_tracking_links logistics_tracking_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_tracking_links
    ADD CONSTRAINT logistics_tracking_links_pkey PRIMARY KEY (id);


--
-- Name: logistics_tracking_links logistics_tracking_links_public_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_tracking_links
    ADD CONSTRAINT logistics_tracking_links_public_id_unique UNIQUE (public_id);


--
-- Name: logistics_tracking_links logistics_tracking_links_request_audience_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_tracking_links
    ADD CONSTRAINT logistics_tracking_links_request_audience_unique UNIQUE (logistics_request_id, audience);


--
-- Name: notification_device_tokens notification_device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_device_tokens
    ADD CONSTRAINT notification_device_tokens_pkey PRIMARY KEY (id);


--
-- Name: notification_device_tokens notification_device_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_device_tokens
    ADD CONSTRAINT notification_device_tokens_token_key UNIQUE (token);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: organizers organizers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizers
    ADD CONSTRAINT organizers_email_key UNIQUE (email);


--
-- Name: organizers organizers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizers
    ADD CONSTRAINT organizers_pkey PRIMARY KEY (id);


--
-- Name: payment_provider_attempts payment_provider_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_provider_attempts
    ADD CONSTRAINT payment_provider_attempts_pkey PRIMARY KEY (id);


--
-- Name: payments payments_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_key UNIQUE (invoice_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payout_provider_attempts payout_provider_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_provider_attempts
    ADD CONSTRAINT payout_provider_attempts_pkey PRIMARY KEY (id);


--
-- Name: payout_reconciliation_events payout_reconciliation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_reconciliation_events
    ADD CONSTRAINT payout_reconciliation_events_pkey PRIMARY KEY (id);


--
-- Name: payouts payouts_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_order_id_key UNIQUE (order_id);


--
-- Name: payouts payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);


--
-- Name: pending_registrations pending_registrations_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_registrations
    ADD CONSTRAINT pending_registrations_email_key UNIQUE (email);


--
-- Name: pending_registrations pending_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_registrations
    ADD CONSTRAINT pending_registrations_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_slug_key UNIQUE (slug);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: product_orders product_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_orders
    ADD CONSTRAINT product_orders_order_number_key UNIQUE (order_number);


--
-- Name: product_orders product_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_orders
    ADD CONSTRAINT product_orders_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: promo_code_uses promo_code_uses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: recent_events recent_events_organizer_id_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_events
    ADD CONSTRAINT recent_events_organizer_id_event_id_key UNIQUE (organizer_id, event_id);


--
-- Name: recent_events recent_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_events
    ADD CONSTRAINT recent_events_pkey PRIMARY KEY (id);


--
-- Name: recent_sales recent_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_sales
    ADD CONSTRAINT recent_sales_pkey PRIMARY KEY (id);


--
-- Name: referral_earnings_log referral_earnings_log_period_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_earnings_log
    ADD CONSTRAINT referral_earnings_log_period_unique UNIQUE (referrer_seller_id, referred_seller_id, period_month, period_year);


--
-- Name: referral_earnings_log referral_earnings_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_earnings_log
    ADD CONSTRAINT referral_earnings_log_pkey PRIMARY KEY (id);


--
-- Name: refund_requests refund_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_slug_key UNIQUE (slug);


--
-- Name: seller_creator_invites seller_creator_invites_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_invites
    ADD CONSTRAINT seller_creator_invites_invite_token_key UNIQUE (invite_token);


--
-- Name: seller_creator_invites seller_creator_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_invites
    ADD CONSTRAINT seller_creator_invites_pkey PRIMARY KEY (id);


--
-- Name: seller_creator_links seller_creator_links_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_links
    ADD CONSTRAINT seller_creator_links_code_key UNIQUE (code);


--
-- Name: seller_creator_links seller_creator_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_links
    ADD CONSTRAINT seller_creator_links_pkey PRIMARY KEY (id);


--
-- Name: seller_creator_links seller_creator_links_seller_id_creator_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_links
    ADD CONSTRAINT seller_creator_links_seller_id_creator_id_key UNIQUE (seller_id, creator_id);


--
-- Name: seller_knocks seller_knocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_knocks
    ADD CONSTRAINT seller_knocks_pkey PRIMARY KEY (id);


--
-- Name: sellers sellers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_pkey PRIMARY KEY (id);


--
-- Name: sellers sellers_shop_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_shop_name_key UNIQUE (shop_name);


--
-- Name: sellers sellers_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_slug_key UNIQUE (slug);


--
-- Name: service_slots service_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_slots
    ADD CONSTRAINT service_slots_pkey PRIMARY KEY (id);


--
-- Name: system_issues system_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_issues
    ADD CONSTRAINT system_issues_pkey PRIMARY KEY (id);


--
-- Name: ticket_types ticket_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT ticket_types_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);


--
-- Name: promo_codes unique_event_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT unique_event_code UNIQUE (event_id, code);


--
-- Name: service_slots unique_service_slot; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_slots
    ADD CONSTRAINT unique_service_slot UNIQUE (service_id, time_slot);


--
-- Name: user_digital_access unique_user_product_access; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_digital_access
    ADD CONSTRAINT unique_user_product_access UNIQUE (user_id, product_id);


--
-- Name: user_digital_access user_digital_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_digital_access
    ADD CONSTRAINT user_digital_access_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webhook_replay_dedupe webhook_replay_dedupe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_replay_dedupe
    ADD CONSTRAINT webhook_replay_dedupe_pkey PRIMARY KEY (event_id);


--
-- Name: wishlist wishlist_buyer_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_buyer_id_product_id_key UNIQUE (buyer_id, product_id);


--
-- Name: wishlist wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_pkey PRIMARY KEY (id);


--
-- Name: wishlists wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_pkey PRIMARY KEY (id);


--
-- Name: withdrawal_requests withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);


--
-- Name: buyers_member_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX buyers_member_number_key ON public.buyers USING btree (member_number) WHERE (member_number IS NOT NULL);


--
-- Name: event_recipient_deliveries_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX event_recipient_deliveries_unique ON public.event_recipient_deliveries USING btree (event_id, recipient_key, channel);


--
-- Name: fulfillment_jobs_order_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fulfillment_jobs_order_id_unique ON public.fulfillment_jobs USING btree (order_id);


--
-- Name: idx_app_notifications_recipient_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_notifications_recipient_created ON public.app_notifications USING btree (recipient_user_id, created_at DESC);


--
-- Name: idx_app_notifications_recipient_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_notifications_recipient_unread ON public.app_notifications USING btree (recipient_user_id, created_at DESC) WHERE (read_at IS NULL);


--
-- Name: idx_buyers_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_city ON public.buyers USING btree (city) WHERE (city IS NOT NULL);


--
-- Name: idx_buyers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_email ON public.buyers USING btree (email);


--
-- Name: idx_buyers_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_location ON public.buyers USING btree (location) WHERE (location IS NOT NULL);


--
-- Name: idx_buyers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_phone ON public.buyers USING btree (phone) WHERE (phone IS NOT NULL);


--
-- Name: idx_buyers_refunds; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_refunds ON public.buyers USING btree (refunds) WHERE (refunds > (0)::numeric);


--
-- Name: idx_buyers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_user_id ON public.buyers USING btree (user_id);


--
-- Name: idx_creator_earnings_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_earnings_creator ON public.creator_earnings USING btree (creator_id);


--
-- Name: idx_creator_earnings_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_earnings_seller ON public.creator_earnings USING btree (seller_id);


--
-- Name: idx_creator_link_clicks_creator_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_link_clicks_creator_recent ON public.creator_link_clicks USING btree (creator_id, created_at DESC);


--
-- Name: idx_creator_link_clicks_link_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_link_clicks_link_recent ON public.creator_link_clicks USING btree (seller_creator_link_id, created_at DESC);


--
-- Name: idx_creator_referral_earnings_referred_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_referral_earnings_referred_seller ON public.creator_referral_earnings USING btree (referred_seller_id) WHERE (referred_seller_id IS NOT NULL);


--
-- Name: idx_creator_referral_earnings_referrer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_referral_earnings_referrer ON public.creator_referral_earnings USING btree (referrer_creator_id);


--
-- Name: idx_creator_shop_requests_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_shop_requests_creator ON public.creator_shop_requests USING btree (creator_id, status);


--
-- Name: idx_creator_shop_requests_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_shop_requests_seller ON public.creator_shop_requests USING btree (seller_id, status);


--
-- Name: idx_creator_withdrawals_creator_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_withdrawals_creator_recent ON public.creator_withdrawal_requests USING btree (creator_id, created_at DESC);


--
-- Name: idx_creator_withdrawals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_withdrawals_status ON public.creator_withdrawal_requests USING btree (status);


--
-- Name: idx_creators_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creators_email ON public.creators USING btree (lower((email)::text));


--
-- Name: idx_creators_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creators_status ON public.creators USING btree (status);


--
-- Name: idx_creators_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creators_user_id ON public.creators USING btree (user_id);


--
-- Name: idx_creators_whatsapp_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creators_whatsapp_number ON public.creators USING btree (whatsapp_number) WHERE (whatsapp_number IS NOT NULL);


--
-- Name: idx_digital_access_buyer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_digital_access_buyer_id ON public.digital_access USING btree (buyer_id);


--
-- Name: idx_digital_access_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_digital_access_order_id ON public.digital_access USING btree (order_id);


--
-- Name: idx_event_dedupe_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_dedupe_expires_at ON public.event_dedupe USING btree (expires_at);


--
-- Name: idx_event_outbox_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_outbox_retry ON public.event_outbox USING btree (status, next_attempt_at, created_at) WHERE ((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('failed'::character varying)::text, ('processing'::character varying)::text]));


--
-- Name: idx_event_recipient_deliveries_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_recipient_deliveries_retry ON public.event_recipient_deliveries USING btree (status, next_retry_at, created_at) WHERE ((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('failed'::character varying)::text, ('processing'::character varying)::text]));


--
-- Name: idx_events_organizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_organizer ON public.events USING btree (organizer_id);


--
-- Name: idx_events_withdrawal_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_withdrawal_status ON public.events USING btree (withdrawal_status);


--
-- Name: idx_fraud_events_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_events_order_id ON public.fraud_events USING btree (order_id);


--
-- Name: idx_fraud_events_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_events_payment_id ON public.fraud_events USING btree (payment_id);


--
-- Name: idx_fraud_events_provider_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_events_provider_reference ON public.fraud_events USING btree (provider_reference) WHERE (provider_reference IS NOT NULL);


--
-- Name: idx_fulfillment_jobs_status_attempts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fulfillment_jobs_status_attempts ON public.fulfillment_jobs USING btree (status, attempts) WHERE (((status)::text = 'PENDING'::text) OR ((status)::text = 'FAILED'::text));


--
-- Name: idx_logistics_legs_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logistics_legs_payment_id ON public.logistics_legs USING btree (payment_id) WHERE (payment_id IS NOT NULL);


--
-- Name: idx_logistics_legs_request_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logistics_legs_request_status ON public.logistics_legs USING btree (logistics_request_id, status, deadline_at, created_at);


--
-- Name: idx_logistics_legs_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logistics_legs_type_status ON public.logistics_legs USING btree (leg_type, status, deadline_at, created_at);


--
-- Name: idx_logistics_partners_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logistics_partners_active ON public.logistics_partners USING btree (active);


--
-- Name: idx_logistics_requests_partner_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logistics_requests_partner_status ON public.logistics_requests USING btree (partner_id, status, deadline_at, created_at);


--
-- Name: idx_logistics_requests_status_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logistics_requests_status_deadline ON public.logistics_requests USING btree (status, deadline_at, created_at);


--
-- Name: idx_logistics_tracking_events_leg_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logistics_tracking_events_leg_created ON public.logistics_tracking_events USING btree (logistics_leg_id, created_at, id) WHERE (logistics_leg_id IS NOT NULL);


--
-- Name: idx_logistics_tracking_events_request_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logistics_tracking_events_request_created ON public.logistics_tracking_events USING btree (logistics_request_id, created_at, id);


--
-- Name: idx_logistics_tracking_links_public_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logistics_tracking_links_public_active ON public.logistics_tracking_links USING btree (public_id, active);


--
-- Name: idx_logistics_tracking_links_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logistics_tracking_links_request ON public.logistics_tracking_links USING btree (logistics_request_id, audience);


--
-- Name: idx_notification_device_tokens_role_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_device_tokens_role_active ON public.notification_device_tokens USING btree (role, is_active);


--
-- Name: idx_notification_device_tokens_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_device_tokens_user_active ON public.notification_device_tokens USING btree (user_id, is_active);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);


--
-- Name: idx_orders_buyer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_buyer_created ON public.product_orders USING btree (buyer_id, created_at DESC);


--
-- Name: idx_orders_notification_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_notification_sent ON public.product_orders USING btree (notification_sent);


--
-- Name: idx_orders_seller_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_seller_status ON public.product_orders USING btree (seller_id, status);


--
-- Name: idx_organizers_password_reset_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizers_password_reset_expires ON public.organizers USING btree (password_reset_expires);


--
-- Name: idx_organizers_password_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizers_password_reset_token ON public.organizers USING btree (password_reset_token);


--
-- Name: idx_payment_provider_attempts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_provider_attempts_status ON public.payment_provider_attempts USING btree (status, last_attempt_at);


--
-- Name: idx_payments_api_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_api_ref ON public.payments USING btree (api_ref) WHERE (api_ref IS NOT NULL);


--
-- Name: idx_payments_metadata_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_metadata_order_id ON public.payments USING btree (((metadata ->> 'order_id'::text)));


--
-- Name: idx_payments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_order_id ON public.payments USING btree (order_id);


--
-- Name: idx_payments_payment_method_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_payment_method_status ON public.payments USING btree (payment_method, status);


--
-- Name: idx_payments_provider_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_provider_reference ON public.payments USING btree (provider_reference) WHERE (provider_reference IS NOT NULL);


--
-- Name: idx_payout_provider_attempts_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_provider_attempts_buyer ON public.payout_provider_attempts USING btree (buyer_id) WHERE (buyer_id IS NOT NULL);


--
-- Name: idx_payout_provider_attempts_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_provider_attempts_creator ON public.payout_provider_attempts USING btree (creator_id) WHERE (creator_id IS NOT NULL);


--
-- Name: idx_payout_provider_attempts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_provider_attempts_status ON public.payout_provider_attempts USING btree (status, last_attempt_at);


--
-- Name: idx_payout_reconciliation_events_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_reconciliation_events_buyer ON public.payout_reconciliation_events USING btree (buyer_id, created_at DESC) WHERE (buyer_id IS NOT NULL);


--
-- Name: idx_payout_reconciliation_events_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_reconciliation_events_creator ON public.payout_reconciliation_events USING btree (creator_id, created_at DESC) WHERE (creator_id IS NOT NULL);


--
-- Name: idx_payout_reconciliation_events_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_reconciliation_events_request ON public.payout_reconciliation_events USING btree (withdrawal_request_id, created_at DESC);


--
-- Name: idx_payouts_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_order_id ON public.payouts USING btree (order_id);


--
-- Name: idx_payouts_pending_settlement_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_pending_settlement_available ON public.payouts USING btree (available_at, id) WHERE ((settlement_status)::text = 'pending_settlement'::text);


--
-- Name: idx_payouts_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_seller_id ON public.payouts USING btree (seller_id);


--
-- Name: idx_payouts_seller_settlement_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_seller_settlement_status ON public.payouts USING btree (seller_id, settlement_status);


--
-- Name: idx_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_status ON public.payouts USING btree (status);


--
-- Name: idx_permissions_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_slug ON public.permissions USING btree (slug);


--
-- Name: idx_product_orders_buyer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_buyer_id ON public.product_orders USING btree (buyer_id);


--
-- Name: idx_product_orders_buyer_pickup_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_buyer_pickup_deadline ON public.product_orders USING btree (buyer_pickup_deadline) WHERE ((buyer_pickup_deadline IS NOT NULL) AND (auto_cancelled_reason IS NULL));


--
-- Name: idx_product_orders_custom_production_grace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_custom_production_grace ON public.product_orders USING btree (custom_production_grace_deadline_at) WHERE ((custom_production_grace_deadline_at IS NOT NULL) AND (auto_cancelled_reason IS NULL));


--
-- Name: idx_product_orders_custom_production_reminder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_custom_production_reminder ON public.product_orders USING btree (custom_production_deadline_at) WHERE ((custom_production_deadline_at IS NOT NULL) AND (custom_production_reminder_sent_at IS NULL));


--
-- Name: idx_product_orders_paid_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_paid_at ON public.product_orders USING btree (paid_at);


--
-- Name: idx_product_orders_payment_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_payment_reference ON public.product_orders USING btree (payment_reference);


--
-- Name: idx_product_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_payment_status ON public.product_orders USING btree (payment_status);


--
-- Name: idx_product_orders_seller_dropoff_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_seller_dropoff_deadline ON public.product_orders USING btree (seller_dropoff_deadline) WHERE ((seller_dropoff_deadline IS NOT NULL) AND (auto_cancelled_reason IS NULL));


--
-- Name: idx_product_orders_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_seller_id ON public.product_orders USING btree (seller_id);


--
-- Name: idx_product_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_status ON public.product_orders USING btree (status);


--
-- Name: idx_product_orders_status_recon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_status_recon ON public.product_orders USING btree (status) WHERE ((status)::text = ANY (ARRAY[('PAID'::character varying)::text, ('FULFILLMENT_PENDING'::character varying)::text, ('RESERVED'::character varying)::text, ('HELD'::character varying)::text]));


--
-- Name: idx_products_aesthetic_status_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_aesthetic_status_seller ON public.products USING btree (aesthetic, status, seller_id) WHERE ((status)::text = 'available'::text);


--
-- Name: idx_products_imported_physical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_imported_physical ON public.products USING btree (seller_id, is_imported_product, import_days) WHERE (is_imported_product = true);


--
-- Name: idx_products_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_seller_id ON public.products USING btree (seller_id);


--
-- Name: idx_promo_code_uses_customer_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_uses_customer_email ON public.promo_code_uses USING btree (customer_email);


--
-- Name: idx_promo_code_uses_promo_code_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_uses_promo_code_id ON public.promo_code_uses USING btree (promo_code_id);


--
-- Name: idx_promo_code_uses_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_uses_ticket_id ON public.promo_code_uses USING btree (ticket_id);


--
-- Name: idx_promo_codes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_active ON public.promo_codes USING btree (is_active, valid_from, valid_until);


--
-- Name: idx_promo_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (code);


--
-- Name: idx_promo_codes_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_event_id ON public.promo_codes USING btree (event_id);


--
-- Name: idx_promo_codes_organizer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_organizer_id ON public.promo_codes USING btree (organizer_id);


--
-- Name: idx_recent_events_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recent_events_event ON public.recent_events USING btree (event_id);


--
-- Name: idx_recent_events_organizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recent_events_organizer ON public.recent_events USING btree (organizer_id);


--
-- Name: idx_recent_sales_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recent_sales_event ON public.recent_sales USING btree (event_id);


--
-- Name: idx_recent_sales_organizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recent_sales_organizer ON public.recent_sales USING btree (organizer_id);


--
-- Name: idx_refund_requests_buyer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_requests_buyer_id ON public.refund_requests USING btree (buyer_id);


--
-- Name: idx_refund_requests_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_requests_order_id ON public.refund_requests USING btree (order_id);


--
-- Name: idx_refund_requests_requested_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_requests_requested_at ON public.refund_requests USING btree (requested_at DESC);


--
-- Name: idx_refund_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_requests_status ON public.refund_requests USING btree (status);


--
-- Name: idx_role_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);


--
-- Name: idx_seller_creator_invites_pending_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_seller_creator_invites_pending_email ON public.seller_creator_invites USING btree (seller_id, lower((email)::text)) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_seller_creator_invites_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_creator_invites_seller ON public.seller_creator_invites USING btree (seller_id);


--
-- Name: idx_seller_creator_invites_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_creator_invites_token ON public.seller_creator_invites USING btree (invite_token);


--
-- Name: idx_seller_creator_links_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_creator_links_code ON public.seller_creator_links USING btree (code);


--
-- Name: idx_seller_creator_links_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_creator_links_creator ON public.seller_creator_links USING btree (creator_id);


--
-- Name: idx_seller_creator_links_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_creator_links_seller ON public.seller_creator_links USING btree (seller_id);


--
-- Name: idx_seller_knocks_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_knocks_created_at ON public.seller_knocks USING btree (created_at);


--
-- Name: idx_seller_knocks_seller_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_knocks_seller_recent ON public.seller_knocks USING btree (seller_id, created_at DESC);


--
-- Name: idx_sellers_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_city ON public.sellers USING btree (city) WHERE (city IS NOT NULL);


--
-- Name: idx_sellers_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_location ON public.sellers USING btree (location) WHERE (location IS NOT NULL);


--
-- Name: idx_sellers_password_reset_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_password_reset_expires ON public.sellers USING btree (password_reset_expires);


--
-- Name: idx_sellers_password_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_password_reset_token ON public.sellers USING btree (password_reset_token);


--
-- Name: idx_sellers_referred_by_creator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_referred_by_creator_id ON public.sellers USING btree (referred_by_creator_id) WHERE (referred_by_creator_id IS NOT NULL);


--
-- Name: idx_sellers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_user_id ON public.sellers USING btree (user_id);


--
-- Name: idx_service_slots_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_slots_service_id ON public.service_slots USING btree (service_id);


--
-- Name: idx_system_issues_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_issues_resolved ON public.system_issues USING btree (resolved) WHERE (resolved = false);


--
-- Name: idx_ticket_types_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_types_event ON public.ticket_types USING btree (event_id);


--
-- Name: idx_tickets_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_event ON public.tickets USING btree (event_id);


--
-- Name: idx_tickets_organizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_organizer ON public.tickets USING btree (organizer_id);


--
-- Name: idx_tickets_ticket_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_ticket_number ON public.tickets USING btree (ticket_number);


--
-- Name: idx_tickets_ticket_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_ticket_type ON public.tickets USING btree (ticket_type_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_users_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email_lower ON public.users USING btree (lower((email)::text));


--
-- Name: idx_users_logistics_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_logistics_email ON public.users USING btree (lower((email)::text)) WHERE ((role)::text = 'logistics'::text);


--
-- Name: idx_webhook_replay_dedupe_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_replay_dedupe_expires_at ON public.webhook_replay_dedupe USING btree (expires_at);


--
-- Name: idx_webhook_replay_dedupe_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_replay_dedupe_status ON public.webhook_replay_dedupe USING btree (status, updated_at, expires_at) WHERE ((status)::text = ANY (ARRAY[('processing'::character varying)::text, ('failed'::character varying)::text]));


--
-- Name: idx_wishlist_buyer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_buyer_id ON public.wishlist USING btree (buyer_id);


--
-- Name: idx_wishlist_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_product_id ON public.wishlist USING btree (product_id);


--
-- Name: idx_withdrawal_requests_buyer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_buyer_status ON public.withdrawal_requests USING btree (buyer_id, status) WHERE (buyer_id IS NOT NULL);


--
-- Name: idx_withdrawal_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_created_at ON public.withdrawal_requests USING btree (created_at);


--
-- Name: idx_withdrawal_requests_creator_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_creator_status ON public.withdrawal_requests USING btree (creator_id, status) WHERE (creator_id IS NOT NULL);


--
-- Name: idx_withdrawal_requests_method_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_method_status ON public.withdrawal_requests USING btree (((metadata ->> 'provider'::text)), status);


--
-- Name: idx_withdrawal_requests_processing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_processing ON public.withdrawal_requests USING btree (status, api_call_pending, created_at) WHERE ((status)::text = 'processing'::text);


--
-- Name: idx_withdrawal_requests_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_seller_id ON public.withdrawal_requests USING btree (seller_id);


--
-- Name: idx_withdrawal_requests_seller_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_seller_status ON public.withdrawal_requests USING btree (seller_id, status);


--
-- Name: idx_withdrawal_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_status ON public.withdrawal_requests USING btree (status);


--
-- Name: logistics_partners_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX logistics_partners_slug_unique ON public.logistics_partners USING btree (slug);


--
-- Name: logistics_partners_user_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX logistics_partners_user_unique ON public.logistics_partners USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: logistics_requests_package_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX logistics_requests_package_code_unique ON public.logistics_requests USING btree (package_code) WHERE (package_code IS NOT NULL);


--
-- Name: logistics_tracking_events_event_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX logistics_tracking_events_event_key_unique ON public.logistics_tracking_events USING btree (event_key) WHERE (event_key IS NOT NULL);


--
-- Name: payment_provider_attempts_api_ref_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_provider_attempts_api_ref_unique ON public.payment_provider_attempts USING btree (api_ref);


--
-- Name: payment_provider_attempts_payment_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_provider_attempts_payment_unique ON public.payment_provider_attempts USING btree (payment_id);


--
-- Name: payout_provider_attempts_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payout_provider_attempts_idempotency_unique ON public.payout_provider_attempts USING btree (idempotency_key);


--
-- Name: payout_provider_attempts_provider_reference_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payout_provider_attempts_provider_reference_unique ON public.payout_provider_attempts USING btree (provider_reference) WHERE (provider_reference IS NOT NULL);


--
-- Name: payout_provider_attempts_request_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payout_provider_attempts_request_unique ON public.payout_provider_attempts USING btree (withdrawal_request_id);


--
-- Name: payout_reconciliation_events_global_reference_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payout_reconciliation_events_global_reference_unique ON public.payout_reconciliation_events USING btree (event_type, reference_key) WHERE (withdrawal_request_id IS NULL);


--
-- Name: payout_reconciliation_events_unique_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payout_reconciliation_events_unique_reference ON public.payout_reconciliation_events USING btree (withdrawal_request_id, event_type, reference_key);


--
-- Name: payouts_order_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payouts_order_id_unique ON public.payouts USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: product_orders_client_checkout_token_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_orders_client_checkout_token_unique ON public.product_orders USING btree (client_checkout_token) WHERE (client_checkout_token IS NOT NULL);


--
-- Name: product_orders_client_checkout_token_unique_all; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_orders_client_checkout_token_unique_all ON public.product_orders USING btree (client_checkout_token);


--
-- Name: referral_earnings_log_referred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referral_earnings_log_referred_idx ON public.referral_earnings_log USING btree (referred_seller_id, period_year, period_month);


--
-- Name: referral_earnings_log_referrer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referral_earnings_log_referrer_idx ON public.referral_earnings_log USING btree (referrer_seller_id, period_year, period_month);


--
-- Name: sellers_referral_active_until_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sellers_referral_active_until_idx ON public.sellers USING btree (referral_active_until) WHERE (referral_active_until IS NOT NULL);


--
-- Name: sellers_referral_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sellers_referral_code_unique ON public.sellers USING btree (referral_code) WHERE (referral_code IS NOT NULL);


--
-- Name: sellers_referred_by_seller_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sellers_referred_by_seller_id_idx ON public.sellers USING btree (referred_by_seller_id) WHERE (referred_by_seller_id IS NOT NULL);


--
-- Name: withdrawal_requests_buyer_refund_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX withdrawal_requests_buyer_refund_idempotency_unique ON public.withdrawal_requests USING btree (buyer_id, idempotency_key) WHERE (buyer_id IS NOT NULL);


--
-- Name: withdrawal_requests_creator_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX withdrawal_requests_creator_idempotency_unique ON public.withdrawal_requests USING btree (creator_id, idempotency_key) WHERE (creator_id IS NOT NULL);


--
-- Name: withdrawal_requests_idempotency_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX withdrawal_requests_idempotency_key_unique ON public.withdrawal_requests USING btree (idempotency_key);


--
-- Name: withdrawal_requests_provider_reference_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX withdrawal_requests_provider_reference_unique ON public.withdrawal_requests USING btree (provider_reference) WHERE (provider_reference IS NOT NULL);


--
-- Name: withdrawal_requests_seller_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX withdrawal_requests_seller_idempotency_unique ON public.withdrawal_requests USING btree (seller_id, idempotency_key);


--
-- Name: product_orders generate_order_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER generate_order_number_trigger BEFORE INSERT ON public.product_orders FOR EACH ROW WHEN ((new.order_number IS NULL)) EXECUTE FUNCTION public.generate_order_number();


--
-- Name: tickets generate_ticket_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER generate_ticket_number_trigger BEFORE INSERT ON public.tickets FOR EACH ROW WHEN ((new.ticket_number IS NULL)) EXECUTE FUNCTION public.generate_ticket_number();


-- handle_order_completion_trigger intentionally omitted here — see the note
-- next to handle_order_completion() above.

--
-- Name: logistics_tracking_events logistics_tracking_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER logistics_tracking_events_immutable BEFORE DELETE OR UPDATE ON public.logistics_tracking_events FOR EACH ROW EXECUTE FUNCTION public.prevent_logistics_tracking_event_mutation();


--
-- Name: refund_requests trigger_update_refund_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_refund_requests_updated_at BEFORE UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.update_refund_requests_updated_at();


--
-- Name: buyers update_buyers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_buyers_updated_at BEFORE UPDATE ON public.buyers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: dashboard_stats update_dashboard_stats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_dashboard_stats_updated_at BEFORE UPDATE ON public.dashboard_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: events update_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: order_items update_order_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_orders update_order_status_history_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_order_status_history_trigger AFTER UPDATE OF status ON public.product_orders FOR EACH ROW EXECUTE FUNCTION public.update_order_status_history();

ALTER TABLE public.product_orders DISABLE TRIGGER update_order_status_history_trigger;


--
-- Name: organizers update_organizers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizers_updated_at BEFORE UPDATE ON public.organizers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payouts update_payouts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payouts_updated_at BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_orders update_product_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_orders_updated_at BEFORE UPDATE ON public.product_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: promo_codes update_promo_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: recent_sales update_recent_sales_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_recent_sales_updated_at BEFORE UPDATE ON public.recent_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sellers update_seller_balance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_seller_balance_updated_at BEFORE UPDATE OF balance ON public.sellers FOR EACH ROW WHEN ((old.balance IS DISTINCT FROM new.balance)) EXECUTE FUNCTION public.update_seller_updated_at();


--
-- Name: sellers update_sellers_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sellers_modtime BEFORE UPDATE ON public.sellers FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: sellers update_sellers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON public.sellers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ticket_types update_ticket_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ticket_types_updated_at BEFORE UPDATE ON public.ticket_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tickets update_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: wishlist update_wishlist_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_wishlist_updated_at BEFORE UPDATE ON public.wishlist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: app_notifications app_notifications_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_notifications
    ADD CONSTRAINT app_notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: buyers buyers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyers
    ADD CONSTRAINT buyers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: creator_earnings creator_earnings_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE RESTRICT;


--
-- Name: creator_earnings creator_earnings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE RESTRICT;


--
-- Name: creator_earnings creator_earnings_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: creator_earnings creator_earnings_seller_creator_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_seller_creator_link_id_fkey FOREIGN KEY (seller_creator_link_id) REFERENCES public.seller_creator_links(id) ON DELETE SET NULL;


--
-- Name: creator_earnings creator_earnings_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE RESTRICT;


--
-- Name: creator_link_clicks creator_link_clicks_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_link_clicks
    ADD CONSTRAINT creator_link_clicks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE CASCADE;


--
-- Name: creator_link_clicks creator_link_clicks_seller_creator_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_link_clicks
    ADD CONSTRAINT creator_link_clicks_seller_creator_link_id_fkey FOREIGN KEY (seller_creator_link_id) REFERENCES public.seller_creator_links(id) ON DELETE CASCADE;


--
-- Name: creator_link_clicks creator_link_clicks_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_link_clicks
    ADD CONSTRAINT creator_link_clicks_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: creator_referral_earnings creator_referral_earnings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_referral_earnings
    ADD CONSTRAINT creator_referral_earnings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE RESTRICT;


--
-- Name: creator_referral_earnings creator_referral_earnings_referred_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_referral_earnings
    ADD CONSTRAINT creator_referral_earnings_referred_seller_id_fkey FOREIGN KEY (referred_seller_id) REFERENCES public.sellers(id) ON DELETE RESTRICT;


--
-- Name: creator_referral_earnings creator_referral_earnings_referrer_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_referral_earnings
    ADD CONSTRAINT creator_referral_earnings_referrer_creator_id_fkey FOREIGN KEY (referrer_creator_id) REFERENCES public.creators(id) ON DELETE RESTRICT;


--
-- Name: creator_shop_requests creator_shop_requests_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_shop_requests
    ADD CONSTRAINT creator_shop_requests_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE CASCADE;


--
-- Name: creator_shop_requests creator_shop_requests_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_shop_requests
    ADD CONSTRAINT creator_shop_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: creator_withdrawal_requests creator_withdrawal_requests_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_withdrawal_requests
    ADD CONSTRAINT creator_withdrawal_requests_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE RESTRICT;


--
-- Name: creators creators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creators
    ADD CONSTRAINT creators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dashboard_stats dashboard_stats_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_stats
    ADD CONSTRAINT dashboard_stats_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- Name: digital_access digital_access_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_access
    ADD CONSTRAINT digital_access_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: digital_access digital_access_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_access
    ADD CONSTRAINT digital_access_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE CASCADE;


--
-- Name: digital_access digital_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_access
    ADD CONSTRAINT digital_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: events events_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- Name: tickets fk_event; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT fk_event FOREIGN KEY (event_id) REFERENCES public.events(id);


--
-- Name: tickets fk_organizer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT fk_organizer FOREIGN KEY (organizer_id) REFERENCES public.organizers(id);


--
-- Name: tickets fk_ticket_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT fk_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES public.ticket_types(id);


--
-- Name: fraud_events fraud_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_events
    ADD CONSTRAINT fraud_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE SET NULL;


--
-- Name: fraud_events fraud_events_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_events
    ADD CONSTRAINT fraud_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: fulfillment_jobs fulfillment_jobs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fulfillment_jobs
    ADD CONSTRAINT fulfillment_jobs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE CASCADE;


--
-- Name: logistics_legs logistics_legs_logistics_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_legs
    ADD CONSTRAINT logistics_legs_logistics_request_id_fkey FOREIGN KEY (logistics_request_id) REFERENCES public.logistics_requests(id) ON DELETE RESTRICT;


--
-- Name: logistics_legs logistics_legs_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_legs
    ADD CONSTRAINT logistics_legs_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: logistics_partners logistics_partners_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_partners
    ADD CONSTRAINT logistics_partners_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: logistics_requests logistics_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_requests
    ADD CONSTRAINT logistics_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE RESTRICT;


--
-- Name: logistics_requests logistics_requests_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_requests
    ADD CONSTRAINT logistics_requests_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.logistics_partners(id) ON DELETE RESTRICT;


--
-- Name: logistics_tracking_events logistics_tracking_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_tracking_events
    ADD CONSTRAINT logistics_tracking_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: logistics_tracking_events logistics_tracking_events_leg_request_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_tracking_events
    ADD CONSTRAINT logistics_tracking_events_leg_request_fk FOREIGN KEY (logistics_leg_id, logistics_request_id) REFERENCES public.logistics_legs(id, logistics_request_id) ON DELETE RESTRICT;


--
-- Name: logistics_tracking_events logistics_tracking_events_logistics_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_tracking_events
    ADD CONSTRAINT logistics_tracking_events_logistics_request_id_fkey FOREIGN KEY (logistics_request_id) REFERENCES public.logistics_requests(id) ON DELETE RESTRICT;


--
-- Name: logistics_tracking_links logistics_tracking_links_logistics_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logistics_tracking_links
    ADD CONSTRAINT logistics_tracking_links_logistics_request_id_fkey FOREIGN KEY (logistics_request_id) REFERENCES public.logistics_requests(id) ON DELETE RESTRICT;


--
-- Name: notification_device_tokens notification_device_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_device_tokens
    ADD CONSTRAINT notification_device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE CASCADE;


--
-- Name: payment_provider_attempts payment_provider_attempts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_provider_attempts
    ADD CONSTRAINT payment_provider_attempts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE SET NULL;


--
-- Name: payment_provider_attempts payment_provider_attempts_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_provider_attempts
    ADD CONSTRAINT payment_provider_attempts_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE RESTRICT;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE RESTRICT;


--
-- Name: payout_provider_attempts payout_provider_attempts_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_provider_attempts
    ADD CONSTRAINT payout_provider_attempts_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE SET NULL;


--
-- Name: payout_provider_attempts payout_provider_attempts_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_provider_attempts
    ADD CONSTRAINT payout_provider_attempts_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE SET NULL;


--
-- Name: payout_provider_attempts payout_provider_attempts_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_provider_attempts
    ADD CONSTRAINT payout_provider_attempts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE SET NULL;


--
-- Name: payout_provider_attempts payout_provider_attempts_withdrawal_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_provider_attempts
    ADD CONSTRAINT payout_provider_attempts_withdrawal_request_id_fkey FOREIGN KEY (withdrawal_request_id) REFERENCES public.withdrawal_requests(id) ON DELETE RESTRICT;


--
-- Name: payout_reconciliation_events payout_reconciliation_events_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_reconciliation_events
    ADD CONSTRAINT payout_reconciliation_events_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE SET NULL;


--
-- Name: payout_reconciliation_events payout_reconciliation_events_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_reconciliation_events
    ADD CONSTRAINT payout_reconciliation_events_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE SET NULL;


--
-- Name: payout_reconciliation_events payout_reconciliation_events_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_reconciliation_events
    ADD CONSTRAINT payout_reconciliation_events_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE SET NULL;


--
-- Name: payout_reconciliation_events payout_reconciliation_events_withdrawal_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_reconciliation_events
    ADD CONSTRAINT payout_reconciliation_events_withdrawal_request_id_fkey FOREIGN KEY (withdrawal_request_id) REFERENCES public.withdrawal_requests(id) ON DELETE SET NULL;


--
-- Name: payouts payouts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE RESTRICT;


--
-- Name: payouts payouts_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: payouts payouts_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE SET NULL;


--
-- Name: product_orders product_orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_orders
    ADD CONSTRAINT product_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE SET NULL;


--
-- Name: product_orders product_orders_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_orders
    ADD CONSTRAINT product_orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE SET NULL;


--
-- Name: products products_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: promo_code_uses promo_code_uses_promo_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE CASCADE;


--
-- Name: promo_code_uses promo_code_uses_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: promo_codes promo_codes_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: promo_codes promo_codes_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- Name: recent_events recent_events_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_events
    ADD CONSTRAINT recent_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: recent_events recent_events_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_events
    ADD CONSTRAINT recent_events_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- Name: recent_sales recent_sales_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_sales
    ADD CONSTRAINT recent_sales_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: recent_sales recent_sales_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_sales
    ADD CONSTRAINT recent_sales_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- Name: referral_earnings_log referral_earnings_log_referred_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_earnings_log
    ADD CONSTRAINT referral_earnings_log_referred_seller_id_fkey FOREIGN KEY (referred_seller_id) REFERENCES public.sellers(id) ON DELETE RESTRICT;


--
-- Name: referral_earnings_log referral_earnings_log_referrer_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_earnings_log
    ADD CONSTRAINT referral_earnings_log_referrer_seller_id_fkey FOREIGN KEY (referrer_seller_id) REFERENCES public.sellers(id) ON DELETE RESTRICT;


--
-- Name: refund_requests refund_requests_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE RESTRICT;


--
-- Name: refund_requests refund_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE SET NULL;


--
-- Name: refund_requests refund_requests_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: seller_creator_invites seller_creator_invites_accepted_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_invites
    ADD CONSTRAINT seller_creator_invites_accepted_creator_id_fkey FOREIGN KEY (accepted_creator_id) REFERENCES public.creators(id) ON DELETE SET NULL;


--
-- Name: seller_creator_invites seller_creator_invites_invited_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_invites
    ADD CONSTRAINT seller_creator_invites_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: seller_creator_invites seller_creator_invites_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_invites
    ADD CONSTRAINT seller_creator_invites_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: seller_creator_links seller_creator_links_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_links
    ADD CONSTRAINT seller_creator_links_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE CASCADE;


--
-- Name: seller_creator_links seller_creator_links_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_creator_links
    ADD CONSTRAINT seller_creator_links_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: seller_knocks seller_knocks_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_knocks
    ADD CONSTRAINT seller_knocks_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: sellers sellers_referred_by_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_referred_by_creator_id_fkey FOREIGN KEY (referred_by_creator_id) REFERENCES public.creators(id) ON DELETE SET NULL;


--
-- Name: sellers sellers_referred_by_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_referred_by_seller_id_fkey FOREIGN KEY (referred_by_seller_id) REFERENCES public.sellers(id) ON DELETE SET NULL;


--
-- Name: sellers sellers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: service_slots service_slots_reserved_by_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_slots
    ADD CONSTRAINT service_slots_reserved_by_order_id_fkey FOREIGN KEY (reserved_by_order_id) REFERENCES public.product_orders(id) ON DELETE SET NULL;


--
-- Name: service_slots service_slots_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_slots
    ADD CONSTRAINT service_slots_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: system_issues system_issues_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_issues
    ADD CONSTRAINT system_issues_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE SET NULL;


--
-- Name: ticket_types ticket_types_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT ticket_types_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_ticket_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES public.ticket_types(id) ON DELETE SET NULL;


--
-- Name: user_digital_access user_digital_access_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_digital_access
    ADD CONSTRAINT user_digital_access_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE CASCADE;


--
-- Name: user_digital_access user_digital_access_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_digital_access
    ADD CONSTRAINT user_digital_access_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: user_digital_access user_digital_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_digital_access
    ADD CONSTRAINT user_digital_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES public.roles(slug) ON DELETE SET NULL;


--
-- Name: wishlist wishlist_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: wishlist wishlist_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: wishlists wishlists_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


--
-- Name: wishlists wishlists_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: wishlists wishlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: withdrawal_requests withdrawal_requests_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE RESTRICT;


--
-- Name: withdrawal_requests withdrawal_requests_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE RESTRICT;


--
-- Name: withdrawal_requests withdrawal_requests_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--


--
-- pgmigrations bookkeeping: marks every migration in migrations/ as
-- already applied, so a fresh test database matches the state
-- node scripts/migrate.js would produce, and running it again is a no-op.
--
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (1, '000_initial_schema', '2026-09-05 15:24:30.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (2, '001_add_password_reset_fields', '2026-09-05 15:24:31.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (3, '20240925_create_buyers_table', '2026-09-05 15:24:32.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (4, '20241001_add_theme_to_sellers', '2026-09-05 15:24:33.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (5, '20250107_add_location_fields_to_buyers', '2026-09-05 15:24:34.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (6, '20250108_add_location_fields_to_sellers', '2026-09-05 15:24:35.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (7, '20250822_create_buyers_table', '2026-09-05 15:24:36.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (8, '20250825_add_shop_name_to_sellers', '2026-09-05 15:24:37.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (9, '20250831_add_provider_reference_to_payments', '2026-09-05 15:24:38.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (10, '20250901_add_api_ref_to_payments', '2026-09-05 15:24:39.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (11, '20250902_add_ticket_number_unique_constraint', '2026-09-05 15:24:40.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (12, '20250903_create_wishlist_table', '2026-09-05 15:24:41.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (13, '20250923190004_add_enums_and_constraints', '2026-09-05 15:24:42.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (14, '20250924000000_fix_payment_status_case', '2026-09-05 15:24:43.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (15, '20250929190000_add_banner_image_to_sellers', '2026-09-05 15:24:44.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (16, '20250929220000_add_theme_to_sellers', '2026-09-05 15:24:45.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (17, '20250930150000_add_product_orders_tables', '2026-09-05 15:24:46.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (18, '20251001080000_add_payment_completed_at', '2026-09-05 15:24:47.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (19, '20251001090000_add_balance_to_sellers', '2026-09-05 15:24:48.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (20, '20251001093000_create_payouts_table', '2026-09-05 15:24:49.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (21, '20251001120000_add_ready_for_pickup_status', '2026-09-05 15:24:50.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (22, '20251001120000_remove_balance_from_sellers', '2026-09-05 15:24:51.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (23, '20251001120001_update_payouts_table', '2026-09-05 15:24:52.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (24, '20251001121644_add_sales_columns_to_sellers', '2026-09-05 15:24:53.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (25, '20251001192720_add_balance_to_sellers', '2026-09-05 15:24:54.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (26, '20251003120000_add_created_by_to_order_status_history', '2026-09-05 15:24:55.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (27, '20251004120000_create_withdrawal_requests_table', '2026-09-05 15:24:56.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (28, '20251007120000_fix_order_items_foreign_key', '2026-09-05 15:24:57.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (29, '20251007130000_add_refunds_to_buyers', '2026-09-05 15:24:58.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (30, '20251007140000_create_refund_requests', '2026-09-05 15:24:59.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (31, '20251007150000_fix_order_status_history_foreign_key', '2026-09-05 15:25:00.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (32, '20251025_add_delivery_statuses', '2026-09-05 15:25:01.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (33, '20251025_add_paid_payment_status', '2026-09-05 15:25:02.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (34, '20260418_drop_shipping_address', '2026-09-05 15:25:03.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (35, '20260419000000_master_migration', '2026-09-05 15:25:04.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (36, '20260419_add_buyer_refunds', '2026-09-05 15:25:05.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (37, '20260506160000_sync_order_status', '2026-09-05 15:25:06.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (38, '20260506191000_order_lifecycle_overhaul', '2026-09-05 15:25:07.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (39, '20260507190000_fintech_integrity_constraints', '2026-09-05 15:25:08.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (40, '20260507203000_referral_program_integrity', '2026-09-05 15:25:09.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (41, '20260507231000_final_fintech_stabilization', '2026-09-05 15:25:10.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (42, '20260508010000_webhook_replay_and_notification_delivery', '2026-09-05 15:25:11.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (43, '20260508020000_provider_callback_hardening', '2026-09-05 15:25:12.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (44, '20260508030000_seller_bio_avatar_profile', '2026-09-05 15:25:13.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (45, '20260508040000_seller_knocks', '2026-09-05 15:25:14.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (46, '20260508050000_remove_seller_client_orders', '2026-09-05 15:25:15.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (47, '20260509010000_sync_payment_status_values', '2026-09-05 15:25:16.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (48, '20260509010100_enforce_payment_status_columns', '2026-09-05 15:25:17.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (49, '20260510010000_add_logistics_data_model', '2026-09-05 15:25:18.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (50, '20260510020000_add_delivery_pending_logistics_status', '2026-09-05 15:25:19.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (51, '20260510030000_add_logistics_dashboard_auth', '2026-09-05 15:25:20.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (52, '20260510040000_add_logistics_tracking_links', '2026-09-05 15:25:21.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (53, '20260510050000_allow_logistics_user_role', '2026-09-05 15:25:22.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (54, '20260510060000_add_paystack_provider_lookup_indexes', '2026-09-05 15:25:23.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (55, '20260510070000_allow_paystack_payment_method', '2026-09-05 15:25:24.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (56, '20260511010000_unified_order_logistics_statuses', '2026-09-05 15:25:25.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (57, '20260512170000_sync_delivered_logistics_ready_for_buyer', '2026-09-05 15:25:26.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (58, '20260512180000_harden_logistics_required_columns', '2026-09-05 15:25:27.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (59, '20260513090000_reconcile_financial_metrics', '2026-09-05 15:25:28.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (60, '20260513110000_admin_dashboard_data_integrity', '2026-09-05 15:25:29.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (61, '20260514110000_referral_flat_product_reward', '2026-09-05 15:25:30.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (62, '20260518120000_creator_program', '2026-09-05 15:25:31.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (63, '20260518183000_creator_dashboard_growth', '2026-09-05 15:25:32.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (64, '20260519090000_add_creator_whatsapp_number', '2026-09-05 15:25:33.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (65, '20260520120000_add_missing_fk_indexes', '2026-09-05 15:25:34.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (66, '20260521120000_seller_creator_commission_setting', '2026-09-05 15:25:35.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (67, '20260522170000_harden_seller_financial_metrics', '2026-09-05 15:25:36.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (68, '20260526120000_settlement_aware_seller_wallet', '2026-09-05 15:25:37.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (69, '20260602120000_unify_creator_withdrawals', '2026-09-05 15:25:38.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (70, '20260602180000_custom_physical_product_sla', '2026-09-05 15:25:39.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (71, '20260602200000_imported_product_preorder_sla', '2026-09-05 15:25:40.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (72, '20260608120000_mobile_notifications', '2026-09-05 15:25:41.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (73, '20260610140000_remove_creator_social_links', '2026-09-05 15:25:42.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (74, '20260719120000_buyer_membership', '2026-09-05 15:25:43.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (75, '20260812230000_add_missing_order_deadline_columns', '2026-09-05 15:25:44.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (76, '20260814195000_unified_runtime_schema', '2026-09-05 15:25:45.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (77, '20260816223000_add_order_payment_reference_and_reconcile_schema', '2026-09-05 15:25:46.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (78, '20260817063000_reconcile_seller_is_active', '2026-09-05 15:25:47.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (79, '20260817064000_create_seller_clients', '2026-09-05 15:25:48.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (80, '20260830120000_normalize_product_order_status_casing', '2026-09-05 15:25:49.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (81, '20260830130000_fix_generate_order_number_concurrency', '2026-09-05 15:25:50.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (82, '20260831090000_remove_seller_banner_and_client_feature', '2026-09-05 15:25:51.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (83, '20260831110000_perf_indexes', '2026-09-05 15:25:52.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (84, '20260901190000_add_payments_order_id_and_fk', '2026-09-05 15:25:53.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (85, '20260901200000_remove_financial_cascade_deletes', '2026-09-05 15:25:54.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (86, '20260901210000_add_non_negative_balance_constraints', '2026-09-05 15:25:55.548333');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (87, '20260901230000_fix_order_status_history_type', '2026-09-05 15:26:11.988924');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (88, '20260901231000_add_manual_review_to_refund_requests', '2026-09-05 15:26:12.207027');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (89, '20260901232000_add_refunded_to_payment_status_enum', '2026-09-05 15:26:12.303817');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (90, '20260901234500_fix_digital_access_buyer_foreign_key', '2026-09-05 15:26:12.307263');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (91, '20260902010000_reset_order8_fulfillment_job', '2026-09-05 15:26:12.324289');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (92, '20260902022500_add_updated_at_to_order_items', '2026-09-05 15:26:12.334529');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (93, '20260902120000_reconcile_seller_wallets', '2026-09-05 15:26:12.357122');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (94, '20260902131500_add_sold_at_and_is_sold_to_products', '2026-09-05 15:26:12.429107');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (95, '20260904184500_remove_creator_to_creator_referrals', '2026-09-05 15:26:12.44048');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (96, '20260904194500_creator_shop_collaboration_marketplace', '2026-09-05 15:26:12.448104');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (97, '20260904205500_add_creator_social_links', '2026-09-05 15:26:12.468475');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (98, '20260905120000_add_missing_balance_and_amount_constraints', '2026-09-05 15:26:12.470792');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (99, '20260905130000_add_creator_referral_earnings_metadata_column', '2026-09-05 15:26:12.48493');
INSERT INTO public.pgmigrations (id, name, run_on) VALUES (100, '20260905140000_drop_legacy_order_completion_payout_trigger', '2026-09-05 17:30:00');

-- Advance the bookkeeping sequence past the explicitly-inserted ids above, so a
-- NEW migration applied on top of this restored snapshot inserts id 101+ via the
-- sequence instead of colliding on id=1. pg_dump's data-only append never carries
-- a setval for this manually-seeded table, so a fresh `npm run migrate` against a
-- schema-restored DB would otherwise fail with a pgmigrations_pkey duplicate-key
-- error on the first new migration. Fully schema-qualified for the empty search_path.
SELECT pg_catalog.setval('public.pgmigrations_id_seq', (SELECT MAX(id) FROM public.pgmigrations), true);

-- Required reference/seed data that a migration's DML inserted as a one-time
-- side effect (not a schema object, so `pg_dump --schema-only` never
-- captures it — discovered when LogisticsRequestService.getMzigoEgoPartner
-- found zero rows against a freshly-restored test DB and threw "Active
-- Mzigo Ego logistics partner is not configured"). Mirrors the exact INSERT
-- in migrations/20260510010000_add_logistics_data_model.sql so every
-- fulfillment/logistics code path that resolves this partner works against
-- a schema-restored test DB the same way it does against a migrated one.
-- Fully schema-qualified: this dump runs with an empty search_path (see the
-- `set_config('search_path', '', false)` at the top), so an unqualified
-- `logistics_partners` would fail with "relation does not exist".
INSERT INTO public.logistics_partners (name, slug, active, metadata)
VALUES (
    'Mzigo Ego',
    'mzigo-ego',
    TRUE,
    '{"seeded_by":"20260510010000_add_logistics_data_model"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    active = TRUE,
    updated_at = NOW();

-- Role reference rows, same story: seeded by migration DML (users.role is an FK
-- to roles.slug, and user_roles references roles.id), so a schema-only restore
-- leaves the table empty and any account creation that assigns a role fails the
-- FK. Fully schema-qualified for the empty search_path. Mirrors the slugs the
-- app assigns (see identity auth + seed scripts).
INSERT INTO public.roles (name, slug) VALUES
    ('Buyer', 'buyer'),
    ('Seller', 'seller'),
    ('Admin', 'admin'),
    ('Creator', 'creator'),
    ('Logistics', 'logistics')
ON CONFLICT (slug) DO NOTHING;
