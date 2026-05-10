import { pool } from '../shared/db/database.js';
import { PaymentStatus } from '../shared/constants/enums.js';
import logger from '../shared/utils/logger.js';

const REQUIRED_TABLES = [
    'fraud_events',
    'event_outbox',
    'event_dedupe',
    'payout_provider_attempts',
    'payout_reconciliation_events',
    'webhook_replay_dedupe',
    'event_recipient_deliveries',
    'fulfillment_jobs',
    'withdrawal_requests',
    'product_orders',
    'logistics_partners',
    'logistics_requests',
    'logistics_legs',
    'logistics_tracking_events',
    'logistics_tracking_links'
];

const REQUIRED_COLUMNS = [
    ['event_outbox', 'delivery_attempts'],
    ['event_outbox', 'last_error_type'],
    ['event_outbox', 'final_failure_at'],
    ['withdrawal_requests', 'idempotency_key'],
    ['withdrawal_requests', 'retry_started_at'],
    ['withdrawal_requests', 'retry_worker_id'],
    ['product_orders', 'client_checkout_token'],
    ['payout_provider_attempts', 'withdrawal_request_id'],
    ['payout_provider_attempts', 'idempotency_key'],
    ['payout_provider_attempts', 'status'],
    ['payout_reconciliation_events', 'reference_key'],
    ['fraud_events', 'payment_id'],
    ['fraud_events', 'event_type'],
    ['fraud_events', 'expected_amount'],
    ['fraud_events', 'provider_amount'],
    ['fraud_events', 'payload'],
    ['webhook_replay_dedupe', 'event_id'],
    ['webhook_replay_dedupe', 'expires_at'],
    ['webhook_replay_dedupe', 'status'],
    ['webhook_replay_dedupe', 'attempts'],
    ['webhook_replay_dedupe', 'updated_at'],
    ['event_recipient_deliveries', 'event_id'],
    ['event_recipient_deliveries', 'recipient_key'],
    ['event_recipient_deliveries', 'status'],
    ['event_recipient_deliveries', 'retry_count'],
    ['logistics_partners', 'slug'],
    ['logistics_partners', 'user_id'],
    ['logistics_requests', 'order_id'],
    ['logistics_requests', 'partner_id'],
    ['logistics_requests', 'status'],
    ['logistics_legs', 'logistics_request_id'],
    ['logistics_legs', 'leg_type'],
    ['logistics_legs', 'payer'],
    ['logistics_legs', 'status'],
    ['logistics_tracking_events', 'logistics_request_id'],
    ['logistics_tracking_events', 'event_type'],
    ['logistics_tracking_events', 'status'],
    ['logistics_tracking_events', 'source'],
    ['logistics_tracking_links', 'logistics_request_id'],
    ['logistics_tracking_links', 'audience'],
    ['logistics_tracking_links', 'public_id'],
    ['logistics_tracking_links', 'active']
];

const REQUIRED_INDEXES = [
    'payouts_order_id_unique',
    'fulfillment_jobs_order_id_unique',
    'withdrawal_requests_seller_idempotency_unique',
    'product_orders_client_checkout_token_unique_all',
    'payment_provider_attempts_payment_unique',
    'payment_provider_attempts_api_ref_unique',
    'payout_provider_attempts_request_unique',
    'payout_provider_attempts_idempotency_unique',
    'payout_provider_attempts_provider_reference_unique',
    'withdrawal_requests_provider_reference_unique',
    'payout_reconciliation_events_unique_reference',
    'payout_reconciliation_events_global_reference_unique',
    'idx_event_outbox_retry',
    'idx_fraud_events_payment_id',
    'idx_webhook_replay_dedupe_expires_at',
    'idx_webhook_replay_dedupe_status',
    'event_recipient_deliveries_unique',
    'idx_event_recipient_deliveries_retry',
    'logistics_partners_slug_unique',
    'logistics_partners_user_unique',
    'logistics_requests_order_id_unique',
    'logistics_legs_request_leg_type_unique',
    'logistics_tracking_events_event_key_unique',
    'idx_logistics_requests_partner_status',
    'idx_logistics_requests_status_deadline',
    'idx_logistics_legs_request_status',
    'idx_logistics_legs_type_status',
    'idx_logistics_tracking_events_request_created',
    'logistics_tracking_links_request_audience_unique',
    'logistics_tracking_links_public_id_unique',
    'idx_logistics_tracking_links_public_active'
];

const REQUIRED_TRIGGERS = [
    ['logistics_tracking_events', 'logistics_tracking_events_immutable']
];

const REQUIRED_PAYMENT_STATUS_VALUES = Object.values(PaymentStatus);
const REQUIRED_LOGISTICS_LEG_STATUS_VALUES = [
    'payment_pending',
    'delivery_pending',
    'cancelled'
];

async function tableExists(tableName) {
    const { rowCount } = await pool.query(
        `SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = $1`,
        [tableName]
    );
    return rowCount > 0;
}

async function columnExists(tableName, columnName) {
    const { rowCount } = await pool.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2`,
        [tableName, columnName]
    );
    return rowCount > 0;
}

async function indexExists(indexName) {
    const { rowCount } = await pool.query(
        `SELECT 1
         FROM pg_indexes
         WHERE schemaname = 'public'
           AND indexname = $1`,
        [indexName]
    );
    return rowCount > 0;
}

async function triggerExists(tableName, triggerName) {
    const { rowCount } = await pool.query(
        `SELECT 1
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = $1
           AND t.tgname = $2
           AND NOT t.tgisinternal`,
        [tableName, triggerName]
    );
    return rowCount > 0;
}

async function columnIsNotNull(tableName, columnName) {
    const { rows } = await pool.query(
        `SELECT is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2`,
        [tableName, columnName]
    );
    return rows[0]?.is_nullable === 'NO';
}

async function enumValues(typeName) {
    const { rows } = await pool.query(
        `SELECT e.enumlabel AS value
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
         JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE n.nspname = 'public'
           AND t.typname = $1
         ORDER BY e.enumsortorder`,
        [typeName]
    );
    return rows.map(row => row.value);
}

async function columnDefinition(tableName, columnName) {
    const { rows } = await pool.query(
        `SELECT data_type, udt_name, character_maximum_length
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2`,
        [tableName, columnName]
    );
    return rows[0] || null;
}

async function constraintDefinition(tableName, constraintName) {
    const { rows } = await pool.query(
        `SELECT pg_get_constraintdef(c.oid) AS definition
         FROM pg_constraint c
         JOIN pg_class rel ON rel.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = rel.relnamespace
         WHERE n.nspname = 'public'
           AND rel.relname = $1
           AND c.conname = $2`,
        [tableName, constraintName]
    );
    return rows[0]?.definition || null;
}

async function verifyPaymentStatusStorage(failures) {
    const values = await enumValues('payment_status');
    if (!values.length) {
        failures.push({ type: 'missing_enum_type', name: 'payment_status' });
    } else {
        const missing = REQUIRED_PAYMENT_STATUS_VALUES.filter(value => !values.includes(value));
        for (const value of missing) {
            failures.push({ type: 'missing_payment_status_enum_value', name: `payment_status.${value}` });
        }
    }

    for (const [table, column] of [['payments', 'status'], ['product_orders', 'payment_status']]) {
        const definition = await columnDefinition(table, column);
        if (!definition) {
            continue;
        }

        if (definition.data_type === 'USER-DEFINED' && definition.udt_name === 'payment_status') {
            continue;
        }

        failures.push({
            type: 'payment_status_column_type_mismatch',
            name: `${table}.${column}`,
            requiredType: 'payment_status',
            actualType: definition.data_type,
            actualUdtName: definition.udt_name
        });
    }
}

async function verifyLogisticsStatusStorage(failures) {
    const definition = await constraintDefinition('logistics_legs', 'logistics_legs_status_check');
    if (!definition) {
        failures.push({ type: 'missing_constraint', name: 'logistics_legs.logistics_legs_status_check' });
        return;
    }

    for (const status of REQUIRED_LOGISTICS_LEG_STATUS_VALUES) {
        if (!definition.includes(`'${status}'`)) {
            failures.push({ type: 'missing_logistics_leg_status', name: `logistics_legs.status.${status}` });
        }
    }
}

async function verifyAdvisoryLocks() {
    const { rows } = await pool.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS locked`, ['schema-check']);
    if (rows[0]?.locked) {
        await pool.query(`SELECT pg_advisory_unlock(hashtext($1))`, ['schema-check']);
        return true;
    }
    return false;
}

/**
 * Hard-fail startup if critical fintech schema guarantees are missing.
 * The app must not boot with partial migrations because runtime code depends on
 * these uniqueness, retry, fraud, and outbox structures for money safety.
 */
export const verifyRequiredIndexes = async () => {
    logger.info('[SCHEMA-CHECK] Verifying critical fintech schema structures...');
    const failures = [];

    for (const table of REQUIRED_TABLES) {
        if (!(await tableExists(table))) {
            failures.push({ type: 'missing_table', name: table });
        }
    }

    for (const [table, column] of REQUIRED_COLUMNS) {
        if (!(await columnExists(table, column))) {
            failures.push({ type: 'missing_column', name: `${table}.${column}` });
        }
    }

    for (const index of REQUIRED_INDEXES) {
        if (!(await indexExists(index))) {
            failures.push({ type: 'missing_index_or_constraint', name: index });
        }
    }

    for (const [table, trigger] of REQUIRED_TRIGGERS) {
        if (!(await triggerExists(table, trigger))) {
            failures.push({ type: 'missing_trigger', name: `${table}.${trigger}` });
        }
    }

    if (await columnExists('product_orders', 'client_checkout_token')) {
        if (!(await columnIsNotNull('product_orders', 'client_checkout_token'))) {
            failures.push({ type: 'nullable_required_column', name: 'product_orders.client_checkout_token' });
        }
    }

    await verifyPaymentStatusStorage(failures);
    await verifyLogisticsStatusStorage(failures);

    if (!(await verifyAdvisoryLocks())) {
        failures.push({ type: 'advisory_lock_unavailable', name: 'pg_try_advisory_lock(hashtext(...))' });
    }

    if (failures.length) {
        logger.error('[SCHEMA-CHECK] Critical fintech schema verification failed', {
            failures,
            action: 'Run pending migrations before starting the backend.'
        });
        throw new Error(`Critical fintech schema verification failed: ${failures.map(f => `${f.type}:${f.name}`).join(', ')}`);
    }

    logger.info('[SCHEMA-CHECK] Critical fintech schema structures verified', {
        tables: REQUIRED_TABLES.length,
        columns: REQUIRED_COLUMNS.length,
        indexes: REQUIRED_INDEXES.length,
        triggers: REQUIRED_TRIGGERS.length
    });
};
