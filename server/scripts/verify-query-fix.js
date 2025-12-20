import { pool } from '../src/config/database.js';

async function verifyQuery() {
    console.log('=== Verifying Corrected Payment Query ===');

    const hoursAgo = 24;
    // Removed 'paid' as it is not a valid enum value for payment_status
    const query = `
        SELECT p.id, p.status, p.invoice_id, p.metadata->'email_attempts' as attempts,
               EXISTS (SELECT 1 FROM tickets t WHERE t.metadata->>'payment_id' = p.id::text) as has_ticket
        FROM payments p
        WHERE 
          p.status IN ('completed', 'success') AND
          p.created_at >= NOW() - INTERVAL '${hoursAgo} hours' AND
          (
            -- Either no ticket exists yet
            NOT EXISTS (SELECT 1 FROM tickets t WHERE t.metadata->>'payment_id' = p.id::text) OR
            
            -- Or email was not sent successfully
            (
              p.metadata->'email_attempts' IS NOT NULL AND
              NOT EXISTS (
                SELECT 1 
                FROM jsonb_array_elements(p.metadata->'email_attempts') a 
                WHERE (a->>'success')::boolean = true
              )
            ) OR
            -- Or metadata says email_sent is false/missing
            (COALESCE((p.metadata->>'email_sent')::boolean, false) = false)
          )
        ORDER BY p.created_at DESC
    `;

    try {
        const { rows } = await pool.query(query);
        console.log(`Found ${rows.length} payments that would be processed by the corrected cron job.`);
        rows.forEach(row => {
            console.log(`- ID: ${row.id}, Status: ${row.status}, Invoice: ${row.invoice_id}, Has Ticket: ${row.has_ticket}`);
        });
    } catch (error) {
        console.error('Query failed (this indicates the code will still crash in production):', error.message);
    } finally {
        await pool.end();
    }
}

verifyQuery();
