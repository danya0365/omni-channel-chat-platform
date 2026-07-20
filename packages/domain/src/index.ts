// @omni/domain — หัวใจ business: unified message schema, Result<T>, ports, core services
// ⚠️ ห้าม import framework/transport ใดๆ (บังคับด้วย dependency-cruiser ใน gate) — มีแค่ zod + logic

export * from './result';
export * from './ids';
export * from './schema';
export * from './ports';
export * from './services/ingest-inbound-message';
export * from './services/send-outbound-message';
export * from './services/manage-conversation';
export * from './services/apply-bot-rules';
