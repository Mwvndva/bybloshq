/**
 * One-time broadcast: invite existing buyers (who signed up before the
 * membership feature) to become Byblos members. Sends to BOTH surfaces — the
 * in-app bell feed and an FCM push whose tap deep-links to the dashboard with
 * ?membership=1, which force-opens the opt-in popup.
 *
 * Idempotent: skips buyers who already joined or already received the invite,
 * so re-running only reaches new/uncovered buyers.
 *
 * Usage (inside the backend container):
 *   docker compose exec backend node scripts/broadcast-membership-invite.js --dry-run
 *   docker compose exec backend node scripts/broadcast-membership-invite.js
 */
import { pool } from '../src/shared/db/database.js';
import NotificationService from '../src/services/notification.service.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(
    dryRun
      ? '→ DRY RUN: counting buyers eligible for the membership invite…'
      : '→ Broadcasting the Byblos membership invite to existing buyers…'
  );

  const result = await NotificationService.broadcastMembershipInvite({ dryRun });
  console.log('Result:', JSON.stringify(result));
  console.log('✅ Done.');

  await pool.end();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
