import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

test('protect() supports all six roles: admin, buyer, seller, creator, marketing, logistics', () => {
  const source = read('server/src/middleware/auth.js');

  assert.match(source, /case 'admin':/);
  assert.match(source, /case 'buyer':/);
  assert.match(source, /case 'seller':/);
  assert.match(source, /case 'creator':/);
  assert.match(source, /case 'marketing':/);
  assert.match(source, /case 'logistics':/);

  assert.match(source, /SELECT u\.id as user_table_id[\s\S]*WHERE u\.id = \$1 AND u\.role = 'marketing'/);
  assert.match(source, /SELECT[\s\S]*FROM users u[\s\S]*LEFT JOIN logistics_partners lp ON u\.id = lp\.user_id[\s\S]*WHERE u\.id = \$1[\s\S]*AND u\.role = 'logistics'/);
});

test('signLogisticsToken uses user_id as canonical JWT id claim', () => {
  const helpers = read('server/src/services/logisticsDashboard.helpers.js');

  assert.match(helpers, /function signLogisticsToken\(account\)/);
  assert.match(helpers, /id:\s*account\.user_id,/);
  assert.match(helpers, /partnerId:\s*account\.partner_id,/);
  assert.match(helpers, /role:\s*'logistics',/);
});

test('getPartnerByTokenPayload supports resolution by partnerId or user_id', () => {
  const service = read('server/src/services/logisticsDashboard.service.js');

  assert.match(service, /WHERE \(lp\.id = \$1 OR lp\.user_id = \$2\)/);
  assert.match(service, /WHERE lp\.user_id = \$1/);
});

test('UniversalHttpClient implements single-flight refresh lock to prevent race conditions', () => {
  const client = read('src/lib/http/UniversalHttpClient.ts');

  assert.match(client, /private refreshPromise: Promise<boolean> \| null = null;/);
  assert.match(client, /if \(!this\.refreshPromise\)/);
  assert.match(client, /this\.refreshPromise = this\.authStrategy\.handleUnauthorized\(role\)\.finally\(/);
  assert.match(client, /this\.refreshPromise = null;/);
});

test('logistics partner attachment attaches req.logisticsPartner using logistics_partners.user_id = users.id', () => {
  const authMiddleware = read('server/src/middleware/auth.js');

  assert.match(authMiddleware, /if \(userType === 'logistics' && userData\.profile_id\)/);
  assert.match(authMiddleware, /req\.logisticsPartner = \{/);
  assert.match(authMiddleware, /userId: userData\.user_table_id \|\| decoded\.id/);
});

test('AndroidAuthStrategy constructs Bearer headers from stored tokens and handles refresh', () => {
  const androidStrategy = read('src/lib/auth/AndroidAuthStrategy.ts');
  const logisticsAuth = read('src/api/logistics/auth.ts');

  assert.match(androidStrategy, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.match(androidStrategy, /const refreshToken = await this\.storageAdapter\.getItem\(`\$\{role\}RefreshToken`\)/);
  assert.match(logisticsAuth, /if \(isNativeApp\(\) && data\?\.token\)/);
  assert.match(logisticsAuth, /await storage\.set\('logisticsToken', data\.token\)/);
});
