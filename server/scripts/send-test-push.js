/**
 * One-off test push. Sends an FCM notification to the most recently active
 * device token (optionally filtered by platform), reusing the backend's FCM
 * config and database.
 *
 * Usage (inside the backend container):
 *   docker compose exec backend node scripts/send-test-push.js
 *   docker compose exec backend node scripts/send-test-push.js android
 */
import { pool } from '../src/shared/db/database.js';
import { sendFcmV1, isFcmConfigured } from '../src/config/fcm.js';

async function main() {
  if (!isFcmConfigured()) {
    console.error('❌ FCM is not configured (FIREBASE_SERVICE_ACCOUNT missing on this environment).');
    process.exit(1);
  }

  const platform = process.argv[2] || 'android';
  const { rows } = await pool.query(
    `SELECT token, user_id, role, platform, last_seen_at
       FROM notification_device_tokens
      WHERE is_active = TRUE AND platform = $1
      ORDER BY last_seen_at DESC
      LIMIT 1`,
    [platform]
  );

  if (!rows.length) {
    console.error(`❌ No active ${platform} device token found. Log in on the device and grant notification permission first.`);
    process.exit(1);
  }

  const t = rows[0];
  console.log(`→ Sending test push to user_id=${t.user_id} role=${t.role} (last seen ${t.last_seen_at})`);

  const result = await sendFcmV1({
    token: t.token,
    title: 'Byblos test 🔔',
    body: 'Push notifications are working. You can dismiss this.',
    data: { path: '/', type: 'test' },
  });

  console.log('FCM result:', JSON.stringify(result));
  if (result.ok) {
    console.log('✅ Push sent — check the device.');
  } else {
    console.error('❌ Push failed.', result.unregistered ? '(token is stale/unregistered)' : '');
    process.exitCode = 1;
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
