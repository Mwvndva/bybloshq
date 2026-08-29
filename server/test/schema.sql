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
-- Name: booking_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
    'REFUNDED'
);


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
-- Name: order_item_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_item_status AS ENUM (
    'PENDING',
    'COMPLETED',
    'CANCELLED',
    'REFUNDED'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'PENDING',
    'READY_FOR_PICKUP',
    'PROCESSING',
    'COMPLETED',
    'CANCELLED',
    'FAILED',
    'DELIVERY_PENDING',
    'DELIVERY_COMPLETE',
    'SERVICE_PENDING',
    'CONFIRMED',
    'COLLECTION_PENDING'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'paystack',
    'payd'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled',
    'paid',
    'success',
    'reversed'
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
-- Name: product_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_type AS ENUM (
    'physical',
    'digital',
    'service'
);


--
-- Name: service_location_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_location_type AS ENUM (
    'in_person',
    'online'
);


--
-- Name: service_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_status AS ENUM (
    'draft',
    'active',
    'paused'
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
-- Name: generate_booking_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_booking_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    booking_seq INTEGER;
BEGIN
    -- Get next sequence number
    SELECT COALESCE(MAX(SUBSTRING(booking_number, '\d+$')::INTEGER), 0) + 1 INTO booking_seq
    FROM service_bookings
    WHERE booking_number LIKE 'BKG-%';
    
    -- Set the booking number
    NEW.booking_number := 'BKG-' || LPAD(booking_seq::TEXT, 6, '0');
    
    RETURN NEW;
END;
$_$;


--
-- Name: generate_invoice_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_id(prefix text DEFAULT 'INV'::text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    timestamp_part TEXT;
    random_part TEXT;
BEGIN
    timestamp_part := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS');
    random_part := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN UPPER(prefix) || '-' || timestamp_part || '-' || random_part;
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
    -- Get next sequence number for orders on this date
    SELECT COALESCE(MAX(SUBSTRING(order_number, 18)::INTEGER), 0) + 1 INTO order_seq
    FROM product_orders
    WHERE order_number LIKE order_prefix || '-' || order_date || '-%';
    
    -- Set the order number
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


--
-- Name: handle_order_completion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_order_completion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- When order is marked as completed, update payment status to completed and create a payout record
    IF NEW.status = 'COMPLETED' AND (OLD.status IS DISTINCT FROM 'COMPLETED') THEN
        -- Update payment status to completed
        UPDATE product_orders 
        SET payment_status = 'completed',
            payment_completed_at = NOW()
        WHERE id = NEW.id;
        
        -- Create payout record
        INSERT INTO payouts (
            order_id,
            seller_id,
            amount,
            status,
            payment_method,
            reference_number,
            created_at,
            updated_at
        )
        SELECT 
            NEW.id,
            NEW.seller_id,
            NEW.seller_payout_amount,
            'pending',
            'mpesa', -- Default payment method, can be updated later
            'PYT-' || NEW.order_number,
            NOW(),
            NOW()
        WHERE NEW.seller_payout_amount > 0
        AND NOT EXISTS (
            SELECT 1 FROM payouts WHERE order_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: handle_order_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_order_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Update status timestamp if status changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.status_updated_at = CURRENT_TIMESTAMP;
        
        -- Log the status change
        INSERT INTO order_audit_log (
            order_id, 
            action, 
            details,
            performed_by
        ) VALUES (
            NEW.id,
            'status_update',
            jsonb_build_object(
                'from', COALESCE(OLD.status::text, 'null'),
                'to', NEW.status::text,
                'notes', 'Order status updated'
            ),
            CASE 
                WHEN NEW.status_updated_by IS NOT NULL THEN NEW.status_updated_by 
                ELSE 'system' 
            END
        );
    END IF;
    
    -- Log payment status changes
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
        INSERT INTO order_audit_log (
            order_id, 
            action, 
            details
        ) VALUES (
            NEW.id,
            'payment_status_update',
            jsonb_build_object(
                'from', COALESCE(OLD.payment_status::text, 'null'),
                'to', NEW.payment_status::text,
                'payment_method', COALESCE(NEW.payment_method, 'unknown'),
                'payment_reference', COALESCE(NEW.order_tracking_id, 'none')
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: log_order_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_order_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only log if status has changed
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
        INSERT INTO order_status_history (
            order_id,
            status,
            status_message,
            updated_by,
            source,
            metadata
        ) VALUES (
            COALESCE(NEW.id, OLD.id),
            NEW.status,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'Order created with initial status: ' || NEW.status
                ELSE 'Status changed from ' || COALESCE(OLD.status, 'NULL') || ' to ' || NEW.status
            END,
            current_user,
            'SYSTEM',
            jsonb_build_object(
                'operation', TG_OP,
                'previous_status', OLD.status,
                'new_status', NEW.status,
                'order_id', COALESCE(NEW.id, OLD.id)
            )
        );
    END IF;
    RETURN NEW;
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
-- Name: update_discount_codes_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_discount_codes_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_event_balance_on_ticket_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_event_balance_on_ticket_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- If ticket marked as paid (inserted or updated)
    IF (TG_OP = 'INSERT' AND NEW.status = 'paid') THEN
        UPDATE events SET balance = balance + NEW.price WHERE id = NEW.event_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- If status changed TO paid
        IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
            UPDATE events SET balance = balance + NEW.price WHERE id = NEW.event_id;
        -- If status changed FROM paid (e.g. refunded/cancelled)
        ELSIF (OLD.status = 'paid' AND NEW.status != 'paid') THEN
            UPDATE events SET balance = balance - OLD.price WHERE id = OLD.event_id;
        END IF;
    ELSIF (TG_OP = 'DELETE' AND OLD.status = 'paid') THEN
        UPDATE events SET balance = balance - OLD.price WHERE id = OLD.event_id;
    END IF;
    RETURN NULL;
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
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_history (order_id, status, notes, created_by, created_by_type)
        VALUES (
            NEW.id, 
            NEW.status, 
            'Status changed from ' || COALESCE(OLD.status::TEXT, 'NULL') || ' to ' || NEW.status::TEXT,
            NULL, -- NULL created_by for system updates
            'system'
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
-- Name: update_service_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_service_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: update_status_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_status_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only proceed if the orders table has the required columns
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'orders' AND 
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status_updated_at') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status_updated_by') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'id')
    THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            NEW.status_updated_at = CURRENT_TIMESTAMP;
            
            -- Only try to log if the order_audit_log table exists
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_audit_log') THEN
                INSERT INTO order_audit_log 
                (order_id, action, details, performed_by)
                VALUES (
                    NEW.id,
                    'status_update',
                    jsonb_build_object(
                        'from', COALESCE(OLD.status::text, 'NULL'),
                        'to', COALESCE(NEW.status::text, 'NULL'),
                        'notes', 'Status updated'
                    ),
                    NEW.status_updated_by
                );
            END IF;
        END IF;
    END IF;
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


--
-- Name: update_withdrawal_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_withdrawal_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_withdrawal_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_withdrawal_updated_at() RETURNS trigger
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
-- Name: buyers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buyers (
    id integer NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    mobile_payment character varying(50),
    password character varying(255),
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    reset_password_token character varying(255),
    reset_password_expires timestamp with time zone,
    city character varying(100),
    location character varying(100),
    is_verified boolean DEFAULT false,
    verification_token character varying(255),
    verification_token_expires timestamp with time zone,
    last_login timestamp with time zone,
    refunds numeric(10,2) DEFAULT 0.00 NOT NULL,
    password_changed_at timestamp with time zone,
    user_id integer,
    whatsapp_number character varying(20)
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
-- Name: digital_activations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.digital_activations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    master_key text NOT NULL,
    hardware_binding_id character varying(64),
    activated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: discount_code_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount_code_usage (
    id integer NOT NULL,
    discount_code_id integer NOT NULL,
    ticket_id integer NOT NULL,
    order_id character varying(100),
    discount_amount numeric(10,2) NOT NULL,
    used_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    customer_email character varying(255)
);


--
-- Name: discount_code_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discount_code_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discount_code_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discount_code_usage_id_seq OWNED BY public.discount_code_usage.id;


--
-- Name: discount_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount_codes (
    id integer NOT NULL,
    event_id integer NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    min_order_amount numeric(10,2) DEFAULT 0,
    max_discount_amount numeric(10,2),
    usage_limit integer,
    usage_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    valid_from timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    valid_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    CONSTRAINT discount_codes_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['percentage'::character varying, 'fixed'::character varying])::text[]))),
    CONSTRAINT discount_codes_discount_value_check CHECK ((discount_value > (0)::numeric)),
    CONSTRAINT discount_codes_min_order_amount_check CHECK ((min_order_amount >= (0)::numeric)),
    CONSTRAINT discount_codes_usage_count_check CHECK ((usage_count >= 0))
);


--
-- Name: discount_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discount_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discount_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discount_codes_id_seq OWNED BY public.discount_codes.id;


--
-- Name: event_ticket_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_ticket_types (
    id integer NOT NULL,
    event_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    quantity integer NOT NULL,
    available integer,
    quantity_available integer,
    max_per_order integer DEFAULT 10,
    min_per_order integer DEFAULT 1,
    sold integer DEFAULT 0,
    sales_start_date timestamp with time zone,
    sales_end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_price CHECK ((price >= (0)::numeric)),
    CONSTRAINT valid_quantity CHECK ((quantity >= 0)),
    CONSTRAINT valid_sales_period CHECK (((sales_end_date IS NULL) OR (sales_start_date IS NULL) OR (sales_end_date > sales_start_date)))
);


--
-- Name: event_ticket_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.event_ticket_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_ticket_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.event_ticket_types_id_seq OWNED BY public.event_ticket_types.id;


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
    balance numeric(12,2) DEFAULT 0,
    CONSTRAINT events_withdrawal_status_check CHECK (((withdrawal_status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'withdrawn'::character varying])::text[]))),
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
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer,
    product_name character varying(255) NOT NULL,
    product_price numeric(12,2) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    status public.order_status NOT NULL,
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
    whatsapp_number character varying(50) NOT NULL,
    password character varying(255),
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    is_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp with time zone,
    reset_password_token character varying(255),
    reset_password_expires timestamp with time zone,
    password_reset_token character varying(255),
    password_reset_expires timestamp with time zone,
    balance numeric(12,2) DEFAULT 0,
    user_id integer
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
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    invoice_id character varying(100) NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'KES'::character varying NOT NULL,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    payment_method public.payment_method NOT NULL,
    mobile_payment character varying(20),
    email character varying(255) NOT NULL,
    ticket_id integer,
    ticket_type_id integer,
    event_id integer,
    organizer_id integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    provider_reference character varying(255),
    api_ref character varying(255),
    whatsapp_number character varying(50)
);


--
-- Name: payments_new_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_new_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_new_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_new_id_seq OWNED BY public.payments.id;


--
-- Name: payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payouts (
    id integer NOT NULL,
    order_id integer,
    seller_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    status public.payout_status DEFAULT 'pending'::public.payout_status NOT NULL,
    reference_number character varying(100),
    payment_method character varying(50) NOT NULL,
    payment_reference character varying(100),
    processed_at timestamp with time zone,
    completed_at timestamp with time zone,
    failure_reason text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    platform_fee numeric(12,2) DEFAULT 0 NOT NULL,
    payout_method character varying(50) DEFAULT 'bank_transfer'::character varying NOT NULL,
    notes text
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
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
-- Name: product_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_orders (
    id integer NOT NULL,
    order_number character varying(50) NOT NULL,
    buyer_id integer,
    seller_id integer NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    platform_fee_amount numeric(12,2) DEFAULT 0 NOT NULL,
    seller_payout_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status public.order_status DEFAULT 'PENDING'::public.order_status NOT NULL,
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    payment_method public.payment_method,
    payment_reference character varying(100),
    buyer_name character varying(255) NOT NULL,
    buyer_email character varying(255) NOT NULL,
    buyer_mobile_payment character varying(50) NOT NULL,
    shipping_address jsonb,
    notes text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    payment_completed_at timestamp with time zone,
    currency character varying(3) DEFAULT 'KES'::character varying,
    seller_dropoff_deadline timestamp with time zone,
    buyer_pickup_deadline timestamp with time zone,
    auto_cancelled_reason text,
    ready_for_pickup_at timestamp with time zone,
    buyer_whatsapp_number character varying(50),
    service_requirements text,
    CONSTRAINT chk_product_orders_amount_positive CHECK ((total_amount >= (0)::numeric)),
    CONSTRAINT chk_product_orders_payout_positive CHECK ((seller_payout_amount >= (0)::numeric)),
    CONSTRAINT chk_product_orders_platform_fee_positive CHECK ((platform_fee_amount >= (0)::numeric))
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
    seller_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    image_url text,
    status public.product_status DEFAULT 'draft'::public.product_status NOT NULL,
    aesthetic character varying(50) DEFAULT 'noir'::character varying NOT NULL,
    sold_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_digital boolean DEFAULT false,
    digital_file_path text,
    digital_file_name text,
    product_type public.product_type DEFAULT 'physical'::public.product_type,
    service_locations text,
    service_options jsonb,
    CONSTRAINT valid_price_positive CHECK ((price >= (0)::numeric))
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
-- Name: refund_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_requests (
    id integer NOT NULL,
    buyer_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    payment_method character varying(50),
    payment_details jsonb,
    notes text,
    admin_notes text,
    processed_by integer,
    requested_at timestamp without time zone DEFAULT now() NOT NULL,
    processed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT positive_amount CHECK ((amount > (0)::numeric)),
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'completed'::character varying])::text[])))
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
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(50) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
-- Name: seller_withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_withdrawals (
    id integer NOT NULL,
    seller_id integer NOT NULL,
    mpesa_number character varying(15),
    registered_name character varying(100),
    amount numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processed_by integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reference_number character varying(100),
    transaction_id character varying(100),
    fee numeric(12,2) DEFAULT 0,
    net_amount numeric(12,2) GENERATED ALWAYS AS ((amount - COALESCE(fee, (0)::numeric))) STORED,
    payment_method character varying(50) DEFAULT 'mpesa'::character varying,
    bank_details jsonb,
    receipt_data jsonb,
    initiated_by integer,
    completed_at timestamp with time zone,
    failed_at timestamp with time zone,
    error_message text,
    metadata jsonb,
    CONSTRAINT non_negative_fee CHECK ((fee >= (0)::numeric)),
    CONSTRAINT positive_amount CHECK ((amount > (0)::numeric)),
    CONSTRAINT valid_payment_method CHECK (((payment_method)::text = ANY ((ARRAY['mpesa'::character varying, 'bank_transfer'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: seller_withdrawals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seller_withdrawals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seller_withdrawals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seller_withdrawals_id_seq OWNED BY public.seller_withdrawals.id;


--
-- Name: sellers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sellers (
    id integer NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    whatsapp_number character varying(50) NOT NULL,
    password character varying(255),
    store_name character varying(255),
    bio text,
    avatar_url text,
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    password_reset_token character varying(255),
    password_reset_expires timestamp with time zone,
    city character varying(100),
    location character varying(100),
    shop_name character varying(50) NOT NULL,
    slug character varying(60) GENERATED ALWAYS AS (lower(replace((shop_name)::text, ' '::text, '-'::text))) STORED,
    banner_url text,
    banner_image text,
    banner_image_public_id text,
    theme character varying(50) DEFAULT 'default'::character varying,
    total_sales numeric(12,2) DEFAULT 0 NOT NULL,
    net_revenue numeric(12,2) DEFAULT 0 NOT NULL,
    balance numeric(12,2) DEFAULT 0.00 NOT NULL,
    physical_address text,
    latitude double precision,
    longitude double precision,
    user_id integer,
    instagram_link character varying(255)
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
-- Name: ticket_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_purchases (
    id integer NOT NULL,
    event_id integer NOT NULL,
    ticket_type_id integer NOT NULL,
    quantity integer NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255) NOT NULL,
    whatsapp_number character varying(50),
    amount_paid numeric(10,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    payment_reference character varying(100),
    purchase_status character varying(20) DEFAULT 'pending'::character varying,
    discount_code character varying(50),
    discount_amount numeric(10,2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ticket_purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_purchases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_purchases_id_seq OWNED BY public.ticket_purchases.id;


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
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    payment_id integer,
    purchase_id integer,
    whatsapp_number character varying(50)
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
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id integer NOT NULL,
    role_id integer NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    is_verified boolean DEFAULT false,
    reset_password_token character varying(255),
    reset_password_expires timestamp with time zone,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
-- Name: withdrawal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawal_requests (
    id integer NOT NULL,
    seller_id integer,
    amount numeric(10,2) NOT NULL,
    mpesa_number character varying(15) NOT NULL,
    mpesa_name character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp with time zone,
    processed_by character varying(100),
    organizer_id integer,
    provider_reference character varying(255),
    raw_response jsonb,
    event_id integer,
    metadata jsonb,
    CONSTRAINT valid_mpesa_number CHECK (((mpesa_number)::text ~ '^[0-9]{10,15}$'::text)),
    CONSTRAINT withdrawal_requests_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT withdrawal_requests_owner_check CHECK ((((seller_id IS NOT NULL) AND (organizer_id IS NULL) AND (event_id IS NULL)) OR ((seller_id IS NULL) AND (organizer_id IS NOT NULL) AND (event_id IS NULL)) OR ((seller_id IS NULL) AND (organizer_id IS NOT NULL) AND (event_id IS NOT NULL)))),
    CONSTRAINT withdrawal_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'approved'::character varying, 'rejected'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
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
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawals (
    id integer NOT NULL,
    seller_id integer NOT NULL,
    mpesa_number character varying(15) NOT NULL,
    registered_name character varying(100) NOT NULL,
    amount numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processed_by integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: withdrawals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.withdrawals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: withdrawals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.withdrawals_id_seq OWNED BY public.withdrawals.id;


--
-- Name: buyers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyers ALTER COLUMN id SET DEFAULT nextval('public.buyers_id_seq'::regclass);


--
-- Name: dashboard_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_stats ALTER COLUMN id SET DEFAULT nextval('public.dashboard_stats_id_seq'::regclass);


--
-- Name: discount_code_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_code_usage ALTER COLUMN id SET DEFAULT nextval('public.discount_code_usage_id_seq'::regclass);


--
-- Name: discount_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_codes ALTER COLUMN id SET DEFAULT nextval('public.discount_codes_id_seq'::regclass);


--
-- Name: event_ticket_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_ticket_types ALTER COLUMN id SET DEFAULT nextval('public.event_ticket_types_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


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
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_new_id_seq'::regclass);


--
-- Name: payouts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts ALTER COLUMN id SET DEFAULT nextval('public.payouts_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: product_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_orders ALTER COLUMN id SET DEFAULT nextval('public.product_orders_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: recent_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_events ALTER COLUMN id SET DEFAULT nextval('public.recent_events_id_seq'::regclass);


--
-- Name: recent_sales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_sales ALTER COLUMN id SET DEFAULT nextval('public.recent_sales_id_seq'::regclass);


--
-- Name: refund_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests ALTER COLUMN id SET DEFAULT nextval('public.refund_requests_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: seller_withdrawals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_withdrawals ALTER COLUMN id SET DEFAULT nextval('public.seller_withdrawals_id_seq'::regclass);


--
-- Name: sellers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellers ALTER COLUMN id SET DEFAULT nextval('public.sellers_id_seq'::regclass);


--
-- Name: ticket_purchases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_purchases ALTER COLUMN id SET DEFAULT nextval('public.ticket_purchases_id_seq'::regclass);


--
-- Name: ticket_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_types ALTER COLUMN id SET DEFAULT nextval('public.ticket_types_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wishlist id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist ALTER COLUMN id SET DEFAULT nextval('public.wishlist_id_seq'::regclass);


--
-- Name: withdrawal_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests ALTER COLUMN id SET DEFAULT nextval('public.withdrawal_requests_id_seq'::regclass);


--
-- Name: withdrawals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals ALTER COLUMN id SET DEFAULT nextval('public.withdrawals_id_seq'::regclass);


--
-- Name: buyers buyers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyers
    ADD CONSTRAINT buyers_email_key UNIQUE (email);


--
-- Name: buyers buyers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyers
    ADD CONSTRAINT buyers_pkey PRIMARY KEY (id);


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
-- Name: digital_activations digital_activations_order_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_activations
    ADD CONSTRAINT digital_activations_order_id_product_id_key UNIQUE (order_id, product_id);


--
-- Name: digital_activations digital_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_activations
    ADD CONSTRAINT digital_activations_pkey PRIMARY KEY (id);


--
-- Name: discount_code_usage discount_code_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_code_usage
    ADD CONSTRAINT discount_code_usage_pkey PRIMARY KEY (id);


--
-- Name: discount_codes discount_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_codes
    ADD CONSTRAINT discount_codes_code_key UNIQUE (code);


--
-- Name: discount_codes discount_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_codes
    ADD CONSTRAINT discount_codes_pkey PRIMARY KEY (id);


--
-- Name: event_ticket_types event_ticket_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_ticket_types
    ADD CONSTRAINT event_ticket_types_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


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
-- Name: payments payments_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_new_pkey PRIMARY KEY (id);


--
-- Name: payouts payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);


--
-- Name: payouts payouts_reference_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_reference_number_key UNIQUE (reference_number);


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
-- Name: refund_requests refund_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


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
-- Name: seller_withdrawals seller_withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_withdrawals
    ADD CONSTRAINT seller_withdrawals_pkey PRIMARY KEY (id);


--
-- Name: sellers sellers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_email_key UNIQUE (email);


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
-- Name: ticket_purchases ticket_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_purchases
    ADD CONSTRAINT ticket_purchases_pkey PRIMARY KEY (id);


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
-- Name: tickets tickets_ticket_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_number_unique UNIQUE (ticket_number);


--
-- Name: payments uq_payments_invoice_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT uq_payments_invoice_id UNIQUE (invoice_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


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
-- Name: withdrawal_requests withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);


--
-- Name: withdrawal_requests withdrawal_requests_provider_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_provider_reference_key UNIQUE (provider_reference);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: idx_buyers_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_city ON public.buyers USING btree (city) WHERE (city IS NOT NULL);


--
-- Name: idx_buyers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_email ON public.buyers USING btree (email);


--
-- Name: idx_buyers_last_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_last_login ON public.buyers USING btree (last_login);


--
-- Name: idx_buyers_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_location ON public.buyers USING btree (location) WHERE (location IS NOT NULL);


--
-- Name: idx_buyers_password_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_password_changed_at ON public.buyers USING btree (password_changed_at);


--
-- Name: idx_buyers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_phone ON public.buyers USING btree (mobile_payment) WHERE (mobile_payment IS NOT NULL);


--
-- Name: idx_buyers_refunds; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_refunds ON public.buyers USING btree (refunds) WHERE (refunds > (0)::numeric);


--
-- Name: idx_buyers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buyers_user_id ON public.buyers USING btree (user_id);


--
-- Name: idx_dashboard_stats_organizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_stats_organizer ON public.dashboard_stats USING btree (organizer_id);


--
-- Name: idx_digital_activations_order_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_digital_activations_order_product ON public.digital_activations USING btree (order_id, product_id);


--
-- Name: idx_discount_code_usage_code_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_code_usage_code_id ON public.discount_code_usage USING btree (discount_code_id);


--
-- Name: idx_discount_code_usage_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_code_usage_email ON public.discount_code_usage USING btree (customer_email);


--
-- Name: idx_discount_code_usage_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_code_usage_ticket_id ON public.discount_code_usage USING btree (ticket_id);


--
-- Name: idx_discount_codes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_codes_active ON public.discount_codes USING btree (is_active, valid_from, valid_until);


--
-- Name: idx_discount_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_codes_code ON public.discount_codes USING btree (code);


--
-- Name: idx_discount_codes_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_codes_event_id ON public.discount_codes USING btree (event_id);


--
-- Name: idx_discount_codes_validity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_codes_validity ON public.discount_codes USING btree (valid_from, valid_until, is_active);


--
-- Name: idx_events_organizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_organizer ON public.events USING btree (organizer_id);


--
-- Name: idx_events_start_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_start_date ON public.events USING btree (start_date);


--
-- Name: idx_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_status ON public.events USING btree (status);


--
-- Name: idx_events_withdrawal_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_withdrawal_status ON public.events USING btree (withdrawal_status);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);


--
-- Name: idx_order_status_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_status_history_created_at ON public.order_status_history USING btree (created_at);


--
-- Name: idx_order_status_history_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_status_history_order_id ON public.order_status_history USING btree (order_id);


--
-- Name: idx_organizers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizers_email ON public.organizers USING btree (email);


--
-- Name: idx_organizers_password_reset_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizers_password_reset_expires ON public.organizers USING btree (password_reset_expires);


--
-- Name: idx_organizers_password_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizers_password_reset_token ON public.organizers USING btree (password_reset_token);


--
-- Name: idx_organizers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizers_status ON public.organizers USING btree (status);


--
-- Name: idx_organizers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizers_user_id ON public.organizers USING btree (user_id);


--
-- Name: idx_payments_api_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_api_ref ON public.payments USING btree (api_ref);


--
-- Name: idx_payments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_created_at ON public.payments USING btree (created_at);


--
-- Name: idx_payments_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_email ON public.payments USING btree (lower((email)::text));


--
-- Name: idx_payments_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_event_id ON public.payments USING btree (event_id) WHERE (event_id IS NOT NULL);


--
-- Name: idx_payments_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice_id ON public.payments USING btree (invoice_id);


--
-- Name: idx_payments_organizer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_organizer_id ON public.payments USING btree (organizer_id);


--
-- Name: idx_payments_phone_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_phone_number ON public.payments USING btree (mobile_payment) WHERE (mobile_payment IS NOT NULL);


--
-- Name: idx_payments_provider_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_provider_reference ON public.payments USING btree (provider_reference);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payments_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_ticket_id ON public.payments USING btree (ticket_id) WHERE (ticket_id IS NOT NULL);


--
-- Name: idx_payments_ticket_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_ticket_type ON public.payments USING btree (ticket_type_id);


--
-- Name: idx_payments_ticket_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_ticket_type_id ON public.payments USING btree (ticket_type_id) WHERE (ticket_type_id IS NOT NULL);


--
-- Name: idx_payouts_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_order_id ON public.payouts USING btree (order_id);


--
-- Name: idx_payouts_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_seller_id ON public.payouts USING btree (seller_id);


--
-- Name: idx_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_status ON public.payouts USING btree (status);


--
-- Name: idx_product_orders_buyer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_buyer_id ON public.product_orders USING btree (buyer_id);


--
-- Name: idx_product_orders_buyer_pickup_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_buyer_pickup_deadline ON public.product_orders USING btree (buyer_pickup_deadline) WHERE ((buyer_pickup_deadline IS NOT NULL) AND (status = 'DELIVERY_COMPLETE'::public.order_status));


--
-- Name: idx_product_orders_currency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_currency ON public.product_orders USING btree (currency);


--
-- Name: idx_product_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_order_number ON public.product_orders USING btree (order_number);


--
-- Name: idx_product_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_payment_status ON public.product_orders USING btree (payment_status);


--
-- Name: idx_product_orders_seller_dropoff_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_seller_dropoff_deadline ON public.product_orders USING btree (seller_dropoff_deadline) WHERE ((seller_dropoff_deadline IS NOT NULL) AND (status = 'DELIVERY_PENDING'::public.order_status));


--
-- Name: idx_product_orders_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_seller_id ON public.product_orders USING btree (seller_id);


--
-- Name: idx_product_orders_service_payment_release; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_service_payment_release ON public.product_orders USING btree (status, payment_status, metadata) WHERE ((status = 'DELIVERY_COMPLETE'::public.order_status) AND (payment_status <> 'completed'::public.payment_status));


--
-- Name: idx_product_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_orders_status ON public.product_orders USING btree (status);


--
-- Name: idx_products_aesthetic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_aesthetic ON public.products USING btree (aesthetic);


--
-- Name: idx_products_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_seller ON public.products USING btree (seller_id);


--
-- Name: idx_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_status ON public.products USING btree (status);


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
-- Name: idx_seller_withdrawals_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_withdrawals_created_at ON public.seller_withdrawals USING btree (created_at);


--
-- Name: idx_seller_withdrawals_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_withdrawals_reference ON public.seller_withdrawals USING btree (reference_number);


--
-- Name: idx_seller_withdrawals_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_withdrawals_seller_id ON public.seller_withdrawals USING btree (seller_id);


--
-- Name: idx_seller_withdrawals_seller_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_withdrawals_seller_status ON public.seller_withdrawals USING btree (seller_id, status);


--
-- Name: idx_seller_withdrawals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_withdrawals_status ON public.seller_withdrawals USING btree (status);


--
-- Name: idx_seller_withdrawals_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_withdrawals_transaction_id ON public.seller_withdrawals USING btree (transaction_id);


--
-- Name: idx_sellers_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_city ON public.sellers USING btree (city) WHERE (city IS NOT NULL);


--
-- Name: idx_sellers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_email ON public.sellers USING btree (email);


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
-- Name: idx_sellers_shop_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_shop_name ON public.sellers USING btree (shop_name);


--
-- Name: idx_sellers_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_slug ON public.sellers USING btree (slug);


--
-- Name: idx_sellers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_status ON public.sellers USING btree (status);


--
-- Name: idx_sellers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sellers_user_id ON public.sellers USING btree (user_id);


--
-- Name: idx_ticket_purchases_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_purchases_event ON public.ticket_purchases USING btree (event_id);


--
-- Name: idx_ticket_purchases_ticket_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_purchases_ticket_type ON public.ticket_purchases USING btree (ticket_type_id);


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
-- Name: idx_tickets_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_payment_id ON public.tickets USING btree (payment_id);


--
-- Name: idx_tickets_purchase_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_purchase_id ON public.tickets USING btree (purchase_id);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_status ON public.tickets USING btree (status);


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
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_wishlist_buyer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_buyer_id ON public.wishlist USING btree (buyer_id);


--
-- Name: idx_wishlist_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_product_id ON public.wishlist USING btree (product_id);


--
-- Name: idx_withdrawal_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_created_at ON public.withdrawal_requests USING btree (created_at);


--
-- Name: idx_withdrawal_requests_organizer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_organizer_id ON public.withdrawal_requests USING btree (organizer_id);


--
-- Name: idx_withdrawal_requests_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_seller_id ON public.withdrawal_requests USING btree (seller_id);


--
-- Name: idx_withdrawal_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_status ON public.withdrawal_requests USING btree (status);


--
-- Name: idx_withdrawals_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawals_seller_id ON public.withdrawals USING btree (seller_id);


--
-- Name: idx_withdrawals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawals_status ON public.withdrawals USING btree (status);


--
-- Name: discount_codes discount_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER discount_codes_updated_at BEFORE UPDATE ON public.discount_codes FOR EACH ROW EXECUTE FUNCTION public.update_discount_codes_updated_at();


--
-- Name: product_orders generate_order_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER generate_order_number_trigger BEFORE INSERT ON public.product_orders FOR EACH ROW WHEN ((new.order_number IS NULL)) EXECUTE FUNCTION public.generate_order_number();


--
-- Name: tickets generate_ticket_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER generate_ticket_number_trigger BEFORE INSERT ON public.tickets FOR EACH ROW WHEN ((new.ticket_number IS NULL)) EXECUTE FUNCTION public.generate_ticket_number();


--
-- Name: product_orders handle_order_completion_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_order_completion_trigger AFTER UPDATE OF status ON public.product_orders FOR EACH ROW WHEN (((new.status = 'COMPLETED'::public.order_status) AND (old.status IS DISTINCT FROM 'COMPLETED'::public.order_status))) EXECUTE FUNCTION public.handle_order_completion();


--
-- Name: tickets trigger_update_event_balance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_event_balance AFTER INSERT OR DELETE OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_event_balance_on_ticket_change();


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
-- Name: discount_codes update_discount_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON public.discount_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


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


--
-- Name: organizers update_organizers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizers_updated_at BEFORE UPDATE ON public.organizers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


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
-- Name: recent_sales update_recent_sales_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_recent_sales_updated_at BEFORE UPDATE ON public.recent_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: refund_requests update_refund_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_refund_requests_updated_at BEFORE UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sellers update_seller_balance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_seller_balance_updated_at BEFORE UPDATE OF balance ON public.sellers FOR EACH ROW WHEN ((old.balance IS DISTINCT FROM new.balance)) EXECUTE FUNCTION public.update_seller_updated_at();


--
-- Name: seller_withdrawals update_seller_withdrawal_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_seller_withdrawal_updated_at_trigger BEFORE UPDATE ON public.seller_withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_withdrawal_updated_at();


--
-- Name: seller_withdrawals update_seller_withdrawals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_seller_withdrawals_updated_at BEFORE UPDATE ON public.seller_withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_withdrawal_timestamp();


--
-- Name: sellers update_sellers_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sellers_modtime BEFORE UPDATE ON public.sellers FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: sellers update_sellers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON public.sellers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: event_ticket_types update_ticket_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ticket_types_updated_at BEFORE UPDATE ON public.event_ticket_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ticket_types update_ticket_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ticket_types_updated_at BEFORE UPDATE ON public.ticket_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tickets update_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: wishlist update_wishlist_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_wishlist_updated_at BEFORE UPDATE ON public.wishlist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: withdrawals update_withdrawals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: buyers buyers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyers
    ADD CONSTRAINT buyers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: dashboard_stats dashboard_stats_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_stats
    ADD CONSTRAINT dashboard_stats_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- Name: digital_activations digital_activations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_activations
    ADD CONSTRAINT digital_activations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE CASCADE;


--
-- Name: digital_activations digital_activations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digital_activations
    ADD CONSTRAINT digital_activations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: discount_code_usage discount_code_usage_discount_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_code_usage
    ADD CONSTRAINT discount_code_usage_discount_code_id_fkey FOREIGN KEY (discount_code_id) REFERENCES public.discount_codes(id) ON DELETE CASCADE;


--
-- Name: discount_code_usage discount_code_usage_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_code_usage
    ADD CONSTRAINT discount_code_usage_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: discount_codes discount_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_codes
    ADD CONSTRAINT discount_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.organizers(id);


--
-- Name: discount_codes discount_codes_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_codes
    ADD CONSTRAINT discount_codes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_ticket_types event_ticket_types_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_ticket_types
    ADD CONSTRAINT event_ticket_types_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


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
-- Name: payments fk_payments_event; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_payments_event FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: payments fk_payments_organizer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_payments_organizer FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE SET NULL;


--
-- Name: payments fk_payments_ticket; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_payments_ticket FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: payments fk_payments_ticket_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_payments_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES public.event_ticket_types(id) ON DELETE SET NULL;


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
-- Name: organizers organizers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizers
    ADD CONSTRAINT organizers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payouts payouts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id) ON DELETE SET NULL;


--
-- Name: payouts payouts_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: product_orders product_orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_orders
    ADD CONSTRAINT product_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE SET NULL;


--
-- Name: product_orders product_orders_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_orders
    ADD CONSTRAINT product_orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: products products_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


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
-- Name: refund_requests refund_requests_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;


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
-- Name: seller_withdrawals seller_withdrawals_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_withdrawals
    ADD CONSTRAINT seller_withdrawals_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: sellers sellers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: ticket_purchases ticket_purchases_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_purchases
    ADD CONSTRAINT ticket_purchases_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: ticket_purchases ticket_purchases_ticket_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_purchases
    ADD CONSTRAINT ticket_purchases_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES public.event_ticket_types(id) ON DELETE CASCADE;


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
-- Name: tickets tickets_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.ticket_purchases(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_ticket_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES public.event_ticket_types(id);


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
-- Name: withdrawal_requests withdrawal_requests_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: withdrawal_requests withdrawal_requests_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE CASCADE;


--
-- Name: withdrawal_requests withdrawal_requests_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: withdrawals withdrawals_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

