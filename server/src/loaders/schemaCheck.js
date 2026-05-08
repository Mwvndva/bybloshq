import { pool } from '../shared/db/database.js';
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
    'product_orders'
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
    ['event_recipient_deliveries', 'retry_count']
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
    'idx_event_recipient_deliveries_retry'
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

    if (await columnExists('product_orders', 'client_checkout_token')) {
        if (!(await columnIsNotNull('product_orders', 'client_checkout_token'))) {
            failures.push({ type: 'nullable_required_column', name: 'product_orders.client_checkout_token' });
        }
    }

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
        indexes: REQUIRED_INDEXES.length
    });
};
