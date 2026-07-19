import { PgBoss } from 'pg-boss';

export interface OutboxRelay {
  start(): Promise<void>;
  stop(): Promise<void>;
}

const QUEUE = 'outbox-drain';

/**
 * pg-boss relay = safety-net ของ transactional outbox
 * realtime หลักมาจาก immediate drain (หลัง business tx commit) · relay นี้คือความทนทาน:
 * ถ้า process crash หลัง commit แต่ก่อน drain → schedule ทุกนาทีจะ drain ให้เอง (event ไม่หาย)
 * + เป็นฐานรองรับ multi-instance/scale worker ทีหลัง (ดู ADR-0003)
 * ⚠️ pg-boss สร้าง schema `pgboss` ของตัวเองใน DB ตอน start
 */
export function createOutboxRelay(databaseUrl: string, drain: () => Promise<number>): OutboxRelay {
  const boss = new PgBoss(databaseUrl);
  let started = false;

  return {
    start: async () => {
      await boss.start();
      await boss.createQueue(QUEUE);
      await boss.work(QUEUE, async () => {
        await drain();
      });
      // cron ขั้นต่ำ = 1 นาที · เป็น safety net เท่านั้น (realtime มาจาก immediate drain)
      await boss.schedule(QUEUE, '* * * * *');
      started = true;
    },
    stop: async () => {
      if (started) await boss.stop();
    },
  };
}
