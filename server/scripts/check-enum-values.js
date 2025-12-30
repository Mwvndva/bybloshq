import { pool } from '../src/config/database.js';

async function checkEnumValues() {
  const client = await pool.connect();

  try {
    // Check order_status enum values
    const orderStatusResult = await client.query(
      "SELECT enum_range(NULL::order_status) as values;"
    );
    console.log('order_status values:', orderStatusResult.rows[0].values);

    // Check payment_status enum values
    const paymentStatusResult = await client.query(
      "SELECT enum_range(NULL::payment_status) as values;"
    );
    console.log('payment_status values:', paymentStatusResult.rows[0].values);

    // Check payment_method enum values if it exists
    try {
      const paymentMethodResult = await client.query(
        "SELECT enum_range(NULL::payment_method) as values;"
      );
      console.log('payment_method values:', paymentMethodResult.rows[0]?.values || 'Not found');
    } catch (e) {
      console.log('payment_method enum does not exist yet');
    }

    // Check if 'payd' is in payment_method enum
    try {
      const result = await client.query("SELECT 'payd' = ANY(enum_range(NULL::payment_method)) as exists");
      console.log("Is 'payd' in payment_method enum:", result.rows[0].exists);
    } catch (e) {
      console.log("Could not check for 'payd' in enum");
    }

  } catch (error) {
    console.error('Error checking enum values:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkEnumValues().catch(console.error);
