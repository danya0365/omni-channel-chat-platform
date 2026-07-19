// Omni web chat widget — embeddable (build เป็น IIFE `widget.js`, expose global `OmniWidget`)
// mountWidget = DOM view บางๆ ต่อ transport core (client.ts) เข้ากับ UI แชท (vanilla DOM ไม่พึ่ง framework)
// ข้อความลูกค้าใส่ผ่าน textContent เสมอ (กัน XSS) · ไม่ log ข้อความ/PII ลง console

import { createWidgetClient, type WidgetClient, type WidgetStatus } from './client';
import type { WebMessageEvent } from '@omni/channel-web';

export interface MountConfig {
  /** base URL ของ apps/api เช่น http://localhost:3001 */
  apiOrigin: string;
  /** public channel identifier (web channel) */
  channelId: string;
  /** หัวข้อบน widget (default: "แชทกับเรา") */
  title?: string;
}

export interface MountedWidget {
  /** ปิด WS + ถอด DOM ออก */
  destroy(): void;
}

const STYLE_ID = 'omni-widget-styles';
const STYLES = `
.omni-widget{display:flex;flex-direction:column;height:100%;min-height:360px;max-height:560px;
  width:100%;max-width:380px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
  border:1px solid #e3e6ea;border-radius:14px;overflow:hidden;background:#fff;
  box-shadow:0 8px 30px rgba(0,0,0,.08)}
.omni-header{display:flex;align-items:center;gap:8px;padding:12px 14px;
  background:linear-gradient(135deg,#6d5efc,#8a6bff);color:#fff}
.omni-title{font-weight:600;font-size:14px;flex:1}
.omni-status{font-size:11px;opacity:.9;display:flex;align-items:center;gap:5px}
.omni-dot{width:8px;height:8px;border-radius:50%;background:#cbd2d9}
.omni-status[data-status="online"] .omni-dot{background:#3ddc84}
.omni-status[data-status="connecting"] .omni-dot{background:#ffcf4d}
.omni-status[data-status="offline"] .omni-dot{background:#ff6b6b}
.omni-list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;
  background:#f7f8fa}
.omni-row{display:flex;max-width:100%}
.omni-row.me{justify-content:flex-end}
.omni-bubble{max-width:78%;padding:8px 11px;border-radius:14px;font-size:13px;line-height:1.4;
  word-wrap:break-word;white-space:pre-wrap}
.omni-row.me .omni-bubble{background:#6d5efc;color:#fff;border-bottom-right-radius:4px}
.omni-row.agent .omni-bubble{background:#fff;color:#1a1a1a;border:1px solid #e3e6ea;
  border-bottom-left-radius:4px}
.omni-time{font-size:10px;opacity:.55;margin-top:2px;padding:0 4px}
.omni-form{display:flex;gap:8px;padding:10px;border-top:1px solid #eef0f3;background:#fff}
.omni-input{flex:1;border:1px solid #d7dbe0;border-radius:10px;padding:9px 11px;font-size:13px;
  outline:none;font-family:inherit}
.omni-input:focus{border-color:#8a6bff}
.omni-send{border:none;background:#6d5efc;color:#fff;border-radius:10px;padding:0 15px;
  font-size:13px;font-weight:600;cursor:pointer}
.omni-send:disabled{opacity:.5;cursor:default}
.omni-note{font-size:11px;color:#ff6b6b;padding:4px 14px}
`;

function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  doc.head.appendChild(style);
}

const STATUS_LABEL: Record<WidgetStatus, string> = {
  connecting: 'กำลังเชื่อม…',
  online: 'ออนไลน์',
  offline: 'ออฟไลน์',
};

/** ดึงข้อความจาก content (union) — ตอนนี้มีแต่ text; ชนิดอื่นค่อยเติมทีหลัง */
function contentText(event: WebMessageEvent): string {
  return event.content.type === 'text' ? event.content.text : '[ข้อความชนิดนี้ยังไม่รองรับ]';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

export function mountWidget(target: HTMLElement, config: MountConfig): MountedWidget {
  const doc = target.ownerDocument;
  ensureStyles(doc);

  const root = doc.createElement('div');
  root.className = 'omni-widget';

  // header + status
  const header = doc.createElement('div');
  header.className = 'omni-header';
  const titleEl = doc.createElement('div');
  titleEl.className = 'omni-title';
  titleEl.textContent = config.title ?? 'แชทกับเรา';
  const statusEl = doc.createElement('div');
  statusEl.className = 'omni-status';
  const dot = doc.createElement('span');
  dot.className = 'omni-dot';
  const statusText = doc.createElement('span');
  statusEl.append(dot, statusText);
  header.append(titleEl, statusEl);

  // message list
  const list = doc.createElement('div');
  list.className = 'omni-list';

  // note (error line)
  const note = doc.createElement('div');
  note.className = 'omni-note';
  note.style.display = 'none';

  // input form
  const form = doc.createElement('form');
  form.className = 'omni-form';
  const input = doc.createElement('input');
  input.className = 'omni-input';
  input.type = 'text';
  input.placeholder = 'พิมพ์ข้อความ…';
  input.autocomplete = 'off';
  const send = doc.createElement('button');
  send.className = 'omni-send';
  send.type = 'submit';
  send.textContent = 'ส่ง';
  form.append(input, send);

  root.append(header, list, note, form);
  target.appendChild(root);

  function setStatus(status: WidgetStatus): void {
    statusEl.setAttribute('data-status', status);
    statusText.textContent = STATUS_LABEL[status];
  }
  setStatus('connecting');

  /** append ข้อความ 1 ก้อน (side: me = ลูกค้า, agent = ทีมงาน/บอท) */
  function appendMessage(side: 'me' | 'agent', text: string, iso?: string): void {
    const row = doc.createElement('div');
    row.className = `omni-row ${side}`;
    const wrap = doc.createElement('div');
    const bubble = doc.createElement('div');
    bubble.className = 'omni-bubble';
    bubble.textContent = text; // textContent = กัน XSS
    wrap.appendChild(bubble);
    if (iso) {
      const time = doc.createElement('div');
      time.className = 'omni-time';
      time.textContent = formatTime(iso);
      wrap.appendChild(time);
    }
    row.appendChild(wrap);
    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
  }

  function showNote(message: string): void {
    note.textContent = message;
    note.style.display = 'block';
  }
  function clearNote(): void {
    note.style.display = 'none';
  }

  const client: WidgetClient = createWidgetClient({
    apiOrigin: config.apiOrigin,
    channelId: config.channelId,
    onStatus: setStatus,
    onMessage: (event) => {
      // WS ส่งมาแต่ outbound (ทีมงาน/บอทตอบ) — echo ของ inbound เราไม่ได้เปิด
      const side = event.direction === 'inbound' ? 'me' : 'agent';
      appendMessage(side, contentText(event), event.at);
    },
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    clearNote();
    input.value = '';
    send.disabled = true;
    client
      .sendText(text)
      .then((res) => {
        // inbound ไม่ echo กลับทาง WS → แสดงข้อความตัวเองแบบ optimistic
        appendMessage('me', text, res.at);
      })
      .catch(() => {
        showNote('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง');
        input.value = text; // คืนข้อความให้ผู้ใช้ไม่ต้องพิมพ์ซ้ำ
      })
      .finally(() => {
        send.disabled = false;
        input.focus();
      });
  });

  void client.start().catch(() => showNote('เชื่อมต่อไม่สำเร็จ'));

  return {
    destroy() {
      client.stop();
      root.remove();
    },
  };
}
