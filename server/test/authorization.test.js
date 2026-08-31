// RBAC boundary tests for AuthorizationService.hasPermission (no DB required).
//
// Passing a pre-populated `permissions` Set short-circuits the DB lookup, so these
// tests exercise pure authorization logic — in particular the hardcoded fallback
// permission maps, which are the privilege-escalation risk surface. The point is
// to prove a buyer can never obtain seller/admin capabilities through the fallback.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import AuthorizationService from '../src/domains/identity/auth/authorization.service.js';

const userWith = (over = {}) => ({ id: 1, userId: 1, permissions: new Set(), ...over });

describe('AuthorizationService.hasPermission — RBAC boundaries', () => {
  it('admin role is granted every permission', async () => {
    const admin = userWith({ role: 'admin' });
    assert.equal(await AuthorizationService.hasPermission(admin, 'manage-all'), true);
    assert.equal(await AuthorizationService.hasPermission(admin, 'anything-at-all'), true);
  });

  it('an explicit manage-all permission grants any permission', async () => {
    const u = userWith({ userType: 'seller', permissions: new Set(['manage-all']) });
    assert.equal(await AuthorizationService.hasPermission(u, 'delete-everything'), true);
  });

  it('a seller gets seller fallback perms but NOT admin/creator perms', async () => {
    const seller = userWith({ userType: 'seller' });
    assert.equal(await AuthorizationService.hasPermission(seller, 'manage-products'), true);
    assert.equal(await AuthorizationService.hasPermission(seller, 'request-payouts'), true);
    // Escalation boundary: fallback must not hand out privileged perms.
    assert.equal(await AuthorizationService.hasPermission(seller, 'manage-all'), false);
    assert.equal(await AuthorizationService.hasPermission(seller, 'manage-users'), false);
  });

  it('a buyer CANNOT obtain seller capabilities via the fallback', async () => {
    const buyer = userWith({ userType: 'buyer' });
    assert.equal(await AuthorizationService.hasPermission(buyer, 'view-orders'), true);
    assert.equal(await AuthorizationService.hasPermission(buyer, 'manage-profile'), true);
    // The critical assertion: buyer must not reach seller/admin scopes.
    assert.equal(await AuthorizationService.hasPermission(buyer, 'manage-products'), false);
    assert.equal(await AuthorizationService.hasPermission(buyer, 'request-payouts'), false);
    assert.equal(await AuthorizationService.hasPermission(buyer, 'manage-shop'), false);
  });

  it('a null/anonymous user has no permissions', async () => {
    assert.equal(await AuthorizationService.hasPermission(null, 'view-orders'), false);
    assert.equal(await AuthorizationService.hasPermission({}, 'view-orders'), false);
  });

  it('cross-role seller profile flag unlocks seller fallback perms', async () => {
    // A buyer-typed session that also owns a seller profile may act as a seller.
    const dual = userWith({ userType: 'buyer', hasSellerProfile: true });
    assert.equal(await AuthorizationService.hasPermission(dual, 'manage-products'), true);
  });
});
