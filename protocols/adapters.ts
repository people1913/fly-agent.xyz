/**
 * Fly Runtime Adapters — Layer 5: 可替换层
 * 
 * Claude/Codex/Cursor/Dify 都是可替换件。
 * 只需要实现 RuntimeAdapter 接口。
 * 下面的 Identity/Verification/Trust/Attribution 全部不动。
 */

import { RuntimeAdapter, Env, ActionSignal, VerificationResult } from './api';

// ============================================================
// Claude Code Adapter
// ============================================================
export class ClaudeAdapter implements RuntimeAdapter {
  async registerAgent(env: Env, config: { provider: string; runtime: string; version: string; owner_id: string }) {
    return { agent_id: `agt_${crypto.randomUUID()}` };
  }
  async createAction(env: Env, signal: Omit<ActionSignal, 'action_id' | 'timestamp'>) {
    return { action_id: `act_${crypto.randomUUID()}` };
  }
  async verifyAction(env: Env, actionId: string, result: VerificationResult, confidence: number) {
    return { verification_id: `vrf_${crypto.randomUUID()}` };
  }
  async queryAction(env: Env, actionId: string) {
    return {};
  }
}

// ============================================================
// Codex Adapter
// ============================================================
export class CodexAdapter implements RuntimeAdapter {
  async registerAgent(env: Env, config: { provider: string; runtime: string; version: string; owner_id: string }) {
    return { agent_id: `agt_${crypto.randomUUID()}` };
  }
  async createAction(env: Env, signal: Omit<ActionSignal, 'action_id' | 'timestamp'>) {
    return { action_id: `act_${crypto.randomUUID()}` };
  }
  async verifyAction(env: Env, actionId: string, result: VerificationResult, confidence: number) {
    return { verification_id: `vrf_${crypto.randomUUID()}` };
  }
  async queryAction(env: Env, actionId: string) {
    return {};
  }
}

// ============================================================
// Cursor Adapter
// ============================================================
export class CursorAdapter implements RuntimeAdapter {
  async registerAgent(env: Env, config: { provider: string; runtime: string; version: string; owner_id: string }) {
    return { agent_id: `agt_${crypto.randomUUID()}` };
  }
  async createAction(env: Env, signal: Omit<ActionSignal, 'action_id' | 'timestamp'>) {
    return { action_id: `act_${crypto.randomUUID()}` };
  }
  async verifyAction(env: Env, actionId: string, result: VerificationResult, confidence: number) {
    return { verification_id: `vrf_${crypto.randomUUID()}` };
  }
  async queryAction(env: Env, actionId: string) {
    return {};
  }
}

// ============================================================
// Dify Adapter
// ============================================================
export class DifyAdapter implements RuntimeAdapter {
  async registerAgent(env: Env, config: { provider: string; runtime: string; version: string; owner_id: string }) {
    return { agent_id: `agt_${crypto.randomUUID()}` };
  }
  async createAction(env: Env, signal: Omit<ActionSignal, 'action_id' | 'timestamp'>) {
    return { action_id: `act_${crypto.randomUUID()}` };
  }
  async verifyAction(env: Env, actionId: string, result: VerificationResult, confidence: number) {
    return { verification_id: `vrf_${crypto.randomUUID()}` };
  }
  async queryAction(env: Env, actionId: string) {
    return {};
  }
}

// ============================================================
// Adapter 工厂
// ============================================================
export function getAdapter(provider: string): RuntimeAdapter {
  switch (provider) {
    case 'claude': return new ClaudeAdapter();
    case 'codex': return new CodexAdapter();
    case 'cursor': return new CursorAdapter();
    case 'dify': return new DifyAdapter();
    default: throw new Error(`unknown provider: ${provider}`);
  }
}
