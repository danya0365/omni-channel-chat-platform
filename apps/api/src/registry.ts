import type { WebConnectionRegistry } from '@omni/channel-web';

/**
 * socket ขั้นต่ำที่ registry ต้องใช้ (subset ของ ws.WebSocket) — ไม่ผูก type ของ ws ตรงๆ
 * เพื่อให้ registry ทดสอบได้ด้วย fake socket ง่ายๆ
 */
export interface RegistrySocket {
  /** ws readyState: 1 = OPEN */
  readyState: number;
  send(data: string): void;
}

const WS_OPEN = 1;

/**
 * ConnectionRegistry (in-memory) — เก็บ WS ที่ต่ออยู่ ตาม key (= session ของ web widget)
 * outbound gateway เรียก `send(key, data)` เพื่อ push เข้า socket ของ session นั้น
 *
 * ⚠️ in-memory ต่อ 1 process — พอสำหรับ Phase 2 (single instance) · หลาย instance ต้องใช้
 * pub/sub (Redis) หรือ sticky routing ภายหลัง (ยังไม่ทำ)
 */
export interface ConnectionRegistry extends WebConnectionRegistry {
  add(key: string, socket: RegistrySocket): void;
  remove(key: string, socket: RegistrySocket): void;
  /** จำนวน socket ปัจจุบันของ key (ไว้ debug/test) */
  size(key: string): number;
}

export function createConnectionRegistry(): ConnectionRegistry {
  const byKey = new Map<string, Set<RegistrySocket>>();

  return {
    add(key, socket) {
      let set = byKey.get(key);
      if (!set) {
        set = new Set();
        byKey.set(key, set);
      }
      set.add(socket);
    },

    remove(key, socket) {
      const set = byKey.get(key);
      if (!set) return;
      set.delete(socket);
      if (set.size === 0) byKey.delete(key);
    },

    send(key, data) {
      const set = byKey.get(key);
      if (!set) return 0;
      let delivered = 0;
      for (const socket of set) {
        if (socket.readyState === WS_OPEN) {
          socket.send(data);
          delivered += 1;
        }
      }
      return delivered;
    },

    size(key) {
      return byKey.get(key)?.size ?? 0;
    },
  };
}
