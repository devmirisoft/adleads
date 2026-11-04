import type { ChatMessage } from '../types';

/**
 * Adds new rows and updates changed ones by id, oldest first. A late response can't undo a newer
 * status (older updatedAt loses). Returns `current` itself when nothing changed, so idle polls
 * don't re-render.
 */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  const changed = incoming.filter((m) => {
    const held = byId.get(m.id);
    return !held || m.updatedAt > held.updatedAt;
  });
  if (!changed.length) return current;
  for (const m of changed) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
