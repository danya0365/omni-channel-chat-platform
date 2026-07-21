import { describe, expect, it } from 'vitest';
import { hasAllEntitlements, hasEntitlement } from './check-entitlement';
import { workspaceEntitlementsSchema } from '../schema/workspace-entitlements';
import type { WorkspaceEntitlements } from '../schema/workspace-entitlements';

const WS = 'ws_01J000000000000000000000';

const make = (modules: WorkspaceEntitlements['modules']): WorkspaceEntitlements => ({
  workspaceId: WS,
  modules,
});

describe('hasEntitlement', () => {
  it('ไม่มี row (null) = ไม่มีสิทธิ์ — fail-closed', () => {
    expect(hasEntitlement(null, 'bot')).toBe(false);
  });

  it('modules ว่าง = ไม่มีสิทธิ์', () => {
    expect(hasEntitlement(make([]), 'bot')).toBe(false);
  });

  it('มีโมดูลที่ถาม = true', () => {
    expect(hasEntitlement(make(['bot', 'reports']), 'bot')).toBe(true);
  });

  it('มีโมดูลอื่นแต่ไม่ใช่ที่ถาม = false (ไม่รั่วข้ามโมดูล)', () => {
    expect(hasEntitlement(make(['reports']), 'ai')).toBe(false);
  });
});

describe('hasAllEntitlements', () => {
  it('ครบทุกตัว = true', () => {
    expect(
      hasAllEntitlements(make(['reports', 'routing_advanced']), ['reports', 'routing_advanced']),
    ).toBe(true);
  });

  it('ขาดตัวเดียว = false', () => {
    expect(hasAllEntitlements(make(['reports']), ['reports', 'routing_advanced'])).toBe(false);
  });

  it('ลิสต์ว่าง = true (ฟีเจอร์ที่ไม่ต้องการสิทธิ์)', () => {
    expect(hasAllEntitlements(null, [])).toBe(true);
  });
});

describe('workspaceEntitlementsSchema', () => {
  it('parse modules ปกติได้', () => {
    const parsed = workspaceEntitlementsSchema.parse({ workspaceId: WS, modules: ['bot', 'ai'] });
    expect(parsed.modules).toEqual(['bot', 'ai']);
  });

  it('ตัดโมดูลที่ไม่รู้จักทิ้ง ไม่ throw (กันเวอร์ชันเก่าเจอค่าใหม่แล้วเสียสิทธิ์ทั้งใบ)', () => {
    const parsed = workspaceEntitlementsSchema.parse({
      workspaceId: WS,
      modules: ['bot', 'quantum_teleport', 'reports'],
    });
    expect(parsed.modules).toEqual(['bot', 'reports']);
  });

  it('modules ไม่ใช่ array = throw', () => {
    expect(() => workspaceEntitlementsSchema.parse({ workspaceId: WS, modules: 'bot' })).toThrow();
  });
});
