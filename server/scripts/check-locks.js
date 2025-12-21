import { pool } from '../src/config/database.js';

async function checkLocks() {
    console.log('=== Checking PostgreSQL Advisory Locks ===\n');

    try {
        // Check for active advisory locks
        const locksQuery = `
            SELECT 
                locktype,
                database,
                classid,
                objid,
                pid,
                mode,
                granted,
                pg_blocking_pids(pid) as blocking_pids
            FROM pg_locks
            WHERE locktype = 'advisory'
            ORDER BY pid;
        `;

        const { rows } = await pool.query(locksQuery);

        if (rows.length === 0) {
            console.log('✅ No advisory locks currently held.');
        } else {
            console.log(`Found ${rows.length} advisory lock(s):\n`);
            rows.forEach((lock, index) => {
                console.log(`Lock ${index + 1}:`);
                console.log(`  PID: ${lock.pid}`);
                console.log(`  Object ID: ${lock.objid} (likely payment_${lock.objid})`);
                console.log(`  Mode: ${lock.mode}`);
                console.log(`  Granted: ${lock.granted}`);
                console.log(`  Blocking PIDs: ${lock.blocking_pids || 'none'}`);
                console.log('');
            });

            console.log('\n⚠️  If these locks are stuck, you can release them by restarting the server.');
            console.log('Or manually release with: SELECT pg_advisory_unlock(<objid>);');
        }

        // Check for long-running queries
        const longQueriesQuery = `
            SELECT 
                pid,
                now() - pg_stat_activity.query_start AS duration,
                state,
                query
            FROM pg_stat_activity
            WHERE state != 'idle'
            AND now() - pg_stat_activity.query_start > interval '30 seconds'
            ORDER BY duration DESC;
        `;

        const longQueries = await pool.query(longQueriesQuery);

        if (longQueries.rows.length > 0) {
            console.log('\n=== Long-Running Queries (>30s) ===\n');
            longQueries.rows.forEach((query, index) => {
                console.log(`Query ${index + 1}:`);
                console.log(`  PID: ${query.pid}`);
                console.log(`  Duration: ${query.duration}`);
                console.log(`  State: ${query.state}`);
                console.log(`  Query: ${query.query.substring(0, 100)}...`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('Error checking locks:', error);
    } finally {
        await pool.end();
    }
}

checkLocks();
