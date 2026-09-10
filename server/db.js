import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const dataDir = path.resolve(process.env.ATHENA_DATA_DIR || 'data');
mkdirSync(path.join(dataDir, 'files'), { recursive: true });
export const db = new DatabaseSync(path.join(dataDir, 'athena.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
const tables = ['projects', 'resources', 'chunks', 'notes', 'concepts', 'reviews', 'attempts', 'evidence', 'schedules', 'preferences'];
for (const table of tables) db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, project_id TEXT, data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS ${table}_project ON ${table}(project_id);`);
const check = table => { if (!tables.includes(table)) throw new Error('Unknown entity'); return table; };
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export function all(table, projectId) {
  return (projectId ? db.prepare(`SELECT data FROM ${check(table)} WHERE project_id=?`).all(projectId) : db.prepare(`SELECT data FROM ${check(table)}`).all()).map(r => JSON.parse(r.data));
}
export function get(table, key) { const row = db.prepare(`SELECT data FROM ${check(table)} WHERE id=?`).get(key); return row ? JSON.parse(row.data) : null; }
export function put(table, value) {
  db.prepare(`INSERT INTO ${check(table)} (id,project_id,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,data=excluded.data`).run(value.id, value.projectId || null, JSON.stringify(value));
  return value;
}
export function remove(table, key) { db.prepare(`DELETE FROM ${check(table)} WHERE id=?`).run(key); }
export function transaction(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } }
export function removeProject(key) { transaction(() => { for (const table of tables.filter(t => !['projects', 'preferences'].includes(t))) db.prepare(`DELETE FROM ${table} WHERE project_id=?`).run(key); remove('projects', key); }); }
export function snapshot() {
  const result = Object.fromEntries(tables.filter(t => t !== 'chunks').map(t => [t, all(t)]));
  result.chunks = all('chunks').map(({ embedding, embeddingModel, ...chunk }) => chunk);
  result.resources = result.resources.map(({ filePath, input, ...resource }) => resource);
  return result;
}
if (!get('preferences', 'local')) put('preferences', { id: 'local', name: 'Learner', view: 'grid', textSize: 'standard', reducedMotion: false, reminders: false });
// A restart interrupts jobs, never their saved input.
for (const resource of all('resources')) if (['Queued', 'Processing'].includes(resource.status)) put('resources', { ...resource, status: 'Failed', error: 'Processing was interrupted. Your original is saved. Retry to continue.' });
for (const attempt of all('attempts')) if (attempt.status === 'Evaluating') put('attempts', { ...attempt, status: 'Submitted', error: 'Evaluation was interrupted. Your response is saved; retry when ready.' });
for (const review of all('reviews')) if (review.status === 'Generating') put('reviews', { ...review, status: 'Generation Failed', error: 'Question generation was interrupted. Retry to continue; existing questions and responses are saved.' });
