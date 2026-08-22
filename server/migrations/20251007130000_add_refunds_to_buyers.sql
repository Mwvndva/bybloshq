-- Migration: Add refunds column to buyers table
-- Description: Tracks total refunds for each buyer when orders are cancelled by seller or timeout

DO $$
BEGIN
    -- Add refunds column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'buyers' 
        AND column_name = 'refunds'
    ) THEN
        ALTER TABLE buyers 
        ADD COLUMN refunds DECIMAL(10, 2) DEFAULT 0.00 NOT NULL;
        
        RAISE NOTICE 'Added refunds column to buyers table';
    ELSE
        RAISE NOTICE 'refunds column already exists in buyers table';
    END IF;
    
    -- Add index for faster queries on refunds
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 'buyers'
        AND indexname = 'idx_buyers_refunds'
    ) THEN
        CREATE INDEX idx_buyers_refunds ON buyers(refunds) WHERE refunds > 0;
        RAISE NOTICE 'Created index idx_buyers_refunds';
    END IF;
END $$;

