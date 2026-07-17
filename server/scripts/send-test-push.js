/**
 * One-off test notification. Sends through the backend NotificationService so it
 * exercises BOTH surfaces: the in-app bell feed (app_notifications) and the FCM
 * push (system tray), targeting the most recently active device token.
 *
 * Usage (inside the backend container):
 *   docker compose exec backend node scripts/send-test-push.js
 *   docker compose exec backend node scripts/send-test-push.js android
 */
import { pool } from '../src/shared/db/database.js';
import NotificationService from '../src/services/notification.service.js';

async function main() {
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
  console.log(`→ Sending test notification (in-app + push) to user_id=${t.user_id} role=${t.role} (last seen ${t.last_seen_at})`);

  const results = await NotificationService.send({
    recipientUserId: t.user_id,
    recipientRole: t.role,
    type: 'test',
    title: 'Byblos test 🔔',
    body: 'Test notification — it should show in your bell and as a push.',
    data: { path: '/', type: 'test' },
    channels: ['in_app', 'push'],
  });

  console.log('Results:', JSON.stringify(results));
  console.log('✅ Done — check the in-app bell (may take a few seconds to poll) and the phone tray (background the app to see it).');

  await pool.end();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
