// 2. Create fulfillment_type enum
pgm.sql("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_type') THEN CREATE TYPE fulfillment_type AS ENUM ('BUYER_TO_SELLER', 'COURIER', 'SELLER_TO_BUYER', 'DIGITAL'); END IF; END $$;");

// 3. Add RESERVED and EXPIRED to order_status enum
// If order_status is already an enum, we add values. 
// pgm.addTypeValue('order_status', 'RESERVED', { ifNotExists: true, after: 'PENDING' });
// pgm.addTypeValue('order_status', 'EXPIRED', { ifNotExists: true });
// Using SQL for more control over positioning and ifNotExists
pgm.sql("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'RESERVED' AFTER 'PENDING'");
pgm.sql("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'EXPIRED'");

// 4. Update product_orders table
pgm.addColumn('product_orders', {
    order_type: { type: 'order_type', notNull: true, default: 'PHYSICAL' },
    fulfillment_type: { type: 'fulfillment_type', notNull: true, default: 'BUYER_TO_SELLER' },
    delivery_location: { type: 'jsonb', allowNull: true },
    total_quantity: { type: 'integer', notNull: true, default: 1 },
    reservation_expires_at: { type: 'timestamp with time zone', allowNull: true }
}, { ifNotExists: true });

// 4. Update products table
pgm.addColumn('products', {
    reserved_quantity: { type: 'integer', notNull: true, default: 0 }
}, { ifNotExists: true });

// 5. Create service_slots table
pgm.createTable('service_slots', {
    id: 'id',
    service_id: { type: 'integer', notNull: true, references: 'products', onDelete: 'CASCADE' },
    time_slot: { type: 'timestamp with time zone', notNull: true },
    status: { type: 'varchar(20)', notNull: true, default: 'AVAILABLE' }, // AVAILABLE, RESERVED, BOOKED
    reserved_by_order_id: { type: 'integer', references: 'product_orders', onDelete: 'SET NULL' },
    expires_at: { type: 'timestamp with time zone', allowNull: true },
    created_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') }
}, { ifNotExists: true });

// Add unique constraint separately to ensure it handles existing table cases if rerun
pgm.sql("ALTER TABLE service_slots DROP CONSTRAINT IF EXISTS unique_service_slot");
pgm.addConstraint('service_slots', 'unique_service_slot', { unique: ['service_id', 'time_slot'] });

// 6. Create user_digital_access table
pgm.createTable('user_digital_access', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    product_id: { type: 'integer', notNull: true, references: 'products', onDelete: 'CASCADE' },
    order_id: { type: 'integer', notNull: true, references: 'product_orders', onDelete: 'CASCADE' },
    granted_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') }
}, { ifNotExists: true });

pgm.sql("ALTER TABLE user_digital_access DROP CONSTRAINT IF EXISTS unique_user_product_access");
pgm.addConstraint('user_digital_access', 'unique_user_product_access', { unique: ['user_id', 'product_id'] });
};

export const down = async (pgm) => {
    pgm.dropTable('user_digital_access');
    pgm.dropTable('service_slots');
    pgm.dropColumn('products', ['reserved_quantity']);
    pgm.dropColumn('product_orders', ['order_type', 'fulfillment_type', 'delivery_location', 'total_quantity', 'reservation_expires_at']);
    pgm.dropType('order_type');
    pgm.dropType('fulfillment_type');
};
