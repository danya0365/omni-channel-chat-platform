'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  createBotRule,
  deleteBotRule,
  getBotConfig,
  listBotRules,
  setBotConfig,
  updateBotRule,
  UnauthorizedError,
} from '../../data/inbox-api';
import type { BotRulePatchInput, NewBotRule, WireBotConfig, WireBotRule } from '../../domain/types';

export interface UseBotAdmin {
  rules: WireBotRule[];
  config: WireBotConfig | null;
  /** กำลังยิง request อยู่ (disable ปุ่มกันกดซ้ำ) */
  busy: boolean;
  /** ข้อความ error ล่าสุด (null = ปกติ) — เช่นถูกปฏิเสธเพราะไม่ได้ซื้อโมดูล */
  error: string | null;
  /** โหลด rules + config — เรียกตอนเปิดจอจัดการ */
  load: () => Promise<void>;
  create: (input: NewBotRule) => Promise<void>;
  update: (id: string, patch: BotRulePatchInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setSwitches: (input: { botEnabled: boolean; aiEnabled: boolean }) => Promise<void>;
}

/**
 * state ของจอจัดการบอท (Phase 6) — rules + สวิตช์ bot/AI
 * client-fetch: interaction-driven (โหลดตอนผู้ใช้เปิดจอ ไม่ใช่ fetch-on-mount · ดู rule frontend-next §4)
 * ทุก action เรียก api แล้ว sync state จาก response จริง (ไม่เดา) — response คือความจริงเดียว
 */
export function useBotAdmin(onAuthError: () => void): UseBotAdmin {
  const [rules, setRules] = useState<WireBotRule[]>([]);
  const [config, setConfig] = useState<WireBotConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** ครอบ action ทุกตัว — คุม busy/error + logout เมื่อ session หมดอายุ */
  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
      } catch (e) {
        if (e instanceof UnauthorizedError) onAuthError();
        else setError('ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง');
      } finally {
        setBusy(false);
      }
    },
    [onAuthError],
  );

  const load = useCallback(
    () =>
      run(async () => {
        const [nextRules, nextConfig] = await Promise.all([listBotRules(), getBotConfig()]);
        setRules(nextRules);
        setConfig(nextConfig);
      }),
    [run],
  );

  const create = useCallback(
    (input: NewBotRule) =>
      run(async () => {
        const created = await createBotRule(input);
        setRules((prev) => [...prev, created].sort((a, b) => a.priority - b.priority));
      }),
    [run],
  );

  const update = useCallback(
    (id: string, patch: BotRulePatchInput) =>
      run(async () => {
        const updated = await updateBotRule(id, patch);
        setRules((prev) =>
          prev.map((r) => (r.id === id ? updated : r)).sort((a, b) => a.priority - b.priority),
        );
      }),
    [run],
  );

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        await deleteBotRule(id);
        setRules((prev) => prev.filter((r) => r.id !== id));
      }),
    [run],
  );

  const setSwitches = useCallback(
    (input: { botEnabled: boolean; aiEnabled: boolean }) =>
      run(async () => {
        setConfig(await setBotConfig(input));
      }),
    [run],
  );

  return useMemo(
    () => ({ rules, config, busy, error, load, create, update, remove, setSwitches }),
    [rules, config, busy, error, load, create, update, remove, setSwitches],
  );
}
