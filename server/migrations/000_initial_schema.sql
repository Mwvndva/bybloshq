-- 000_initial_schema.sql
-- Consolidated migration file for Byblos platform
-- This file combines all schema definitions into a single, coherent migration

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
DO $$
BEGIN
    -- Product status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
        CREATE TYPE product_status AS ENUM ('draft', 'available', 'sold');
    END IF;
    
    -- Ticket status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');
    END IF;
    
    -- Event status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
        CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
    END IF;
    
    -- User status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'suspended', 'inactive');
    END IF;
END $$;

-- Create update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create generate_ticket_number function
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create sellers table
CREATE TABLE IF NOT EXISTS sellers (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  store_name VARCHAR(255),
  bio TEXT,
  avatar_url TEXT,
  status user_status DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create organizers table
CREATE TABLE IF NOT EXISTS organizers (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  status user_status DEFAULT 'active' NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE,
  reset_password_token VARCHAR(255),
  reset_password_expires TIMESTAMP WITH TIME ZONE
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  location VARCHAR(255) NOT NULL,
  ticket_quantity INTEGER NOT NULL,
  ticket_price DECIMAL(10, 2) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status event_status DEFAULT 'published' NOT NULL,
  CONSTRAINT valid_dates CHECK (end_date > start_date)
);

-- Create ticket_types table
CREATE TABLE IF NOT EXISTS ticket_types (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  sales_start_date TIMESTAMP WITH TIME ZONE,
  sales_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_quantity CHECK (quantity >= 0),
  CONSTRAINT valid_price CHECK (price >= 0),
  CONSTRAINT valid_sales_period CHECK (sales_end_date IS NULL OR sales_start_date IS NULL OR sales_end_date > sales_start_date)
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  ticket_number VARCHAR(50) NOT NULL UNIQUE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  ticket_type_id INTEGER REFERENCES ticket_types(id) ON DELETE SET NULL,
  ticket_type_name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  status ticket_status DEFAULT 'pending' NOT NULL,
  scanned BOOLEAN DEFAULT FALSE,
  scanned_at TIMESTAMP WITH TIME ZONE,
  unit_price DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  total_price DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ticket_type FOREIGN KEY(ticket_type_id) REFERENCES ticket_types(id),
  CONSTRAINT fk_event FOREIGN KEY(event_id) REFERENCES events(id),
  CONSTRAINT fk_organizer FOREIGN KEY(organizer_id) REFERENCES organizers(id)
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  status product_status DEFAULT 'draft' NOT NULL,
  aesthetic VARCHAR(50) DEFAULT 'noir' NOT NULL,
  sold_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_price_positive CHECK (price >= 0)
);

-- Create dashboard_stats table
CREATE TABLE IF NOT EXISTS dashboard_stats (
  id SERIAL PRIMARY KEY,
  organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  total_events INTEGER NOT NULL DEFAULT 0,
  upcoming_events INTEGER NOT NULL DEFAULT 0,
  past_events INTEGER NOT NULL DEFAULT 0,
  current_events INTEGER NOT NULL DEFAULT 0,
  total_tickets_sold INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_attendees INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organizer_id)
);

-- Create recent_events table
CREATE TABLE IF NOT EXISTS recent_events (
  id SERIAL PRIMARY KEY,
  organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organizer_id, event_id)
);

-- Create recent_sales table
CREATE TABLE IF NOT EXISTS recent_sales (
  id SERIAL PRIMARY KEY,
  organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  transaction_id VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  ticket_type VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_organizer ON tickets(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON tickets(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_recent_events_organizer ON recent_events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_recent_events_event ON recent_events(event_id);
CREATE INDEX IF NOT EXISTS idx_recent_sales_organizer ON recent_sales(organizer_id);
CREATE INDEX IF NOT EXISTS idx_recent_sales_event ON recent_sales(event_id);

-- Create triggers for updated_at
CREATE TRIGGER update_sellers_updated_at
BEFORE UPDATE ON sellers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizers_updated_at
BEFORE UPDATE ON organizers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_types_updated_at
BEFORE UPDATE ON ticket_types
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_stats_updated_at
BEFORE UPDATE ON dashboard_stats
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recent_sales_updated_at
BEFORE UPDATE ON recent_sales
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for ticket number generation
CREATE TRIGGER generate_ticket_number_trigger
BEFORE INSERT ON tickets
FOR EACH ROW
WHEN (NEW.ticket_number IS NULL)
EXECUTE FUNCTION generate_ticket_number();
