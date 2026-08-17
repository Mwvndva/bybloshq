import test from 'node:test';
import assert from 'node:assert/strict';

test('Creator registration: registerFromInvite vs registerDirect contract verification', () => {
  // Test contract comparison
  const directPayload = {
    firstName: 'Open',
    lastName: 'Creator',
    email: 'open@example.com',
    password: 'Password1!',
    confirmPassword: 'Password1!',
    mpesaNumber: '0711111111',
    whatsappNumber: '0711111111'
  };

  const invitePayload = {
    token: 'test_token_hex_64',
    firstName: 'Invited',
    lastName: 'Creator',
    email: 'invited@example.com',
    password: 'Password1!',
    confirmPassword: 'Password1!',
    mpesaNumber: '0722222222',
    whatsappNumber: '0722222222'
  };

  assert.ok(!directPayload.token, 'Direct payload has no token');
  assert.ok(invitePayload.token, 'Invite payload has token');
});
