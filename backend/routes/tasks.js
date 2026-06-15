import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, run } from '../db.js';
import { auth, teamRole } from '../middleware.js';

const router = Router();

const MAX_TASK_TEXT = 200;
const MAX_POMODOROS = 60; // 60 pomodoros = 25h, generous upper bound

router.get('/', auth, (req, res) => {
  const { type, team_id } = req.query;
  let sql = 'SELECT * FROM tasks WHERE user_id=?';
  const params = [req.user.id];
  if (type) { sql += ' AND type=?'; params.push(type); }
  if (team_id) { sql += ' AND team_id=?'; params.push(team_id); }
  sql += ' ORDER BY created_at DESC';
  res.json({ tasks: query(sql, params) });
});

router.post('/', auth, (req, res) => {
  let { text, pomodoros = 1, team_id, type = 'personal' } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  text = text.trim().slice(0, MAX_TASK_TEXT);
  pomodoros = Math.max(1, Math.min(MAX_POMODOROS, Number(pomodoros) || 1));

  if (team_id) {
    const member = query('SELECT role FROM team_members WHERE team_id=? AND user_id=?', [team_id, req.user.id])[0];
    if (!member) return res.status(403).json({ error: 'Not a team member' });
  }

  const id = randomUUID();
  run('INSERT INTO tasks (id, user_id, team_id, text, type, pomodoros) VALUES (?,?,?,?,?,?)',
    [id, req.user.id, team_id || null, text, type, pomodoros]);
  res.json({ task: query('SELECT * FROM tasks WHERE id=?', [id])[0] });
});

router.patch('/:id', auth, (req, res) => {
  const task = query('SELECT * FROM tasks WHERE id=?', [req.params.id])[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { done, spent, text } = req.body;
  if (typeof done === 'boolean')
    run('UPDATE tasks SET done=?, done_at=? WHERE id=?', [done ? 1 : 0, done ? Math.floor(Date.now() / 1000) : null, task.id]);
  if (typeof spent === 'number' && Number.isFinite(spent) && spent >= 0)
    run('UPDATE tasks SET spent=? WHERE id=?', [Math.min(spent, 99999), task.id]);
  if (text?.trim())
    run('UPDATE tasks SET text=? WHERE id=?', [text.trim().slice(0, MAX_TASK_TEXT), task.id]);

  res.json({ task: query('SELECT * FROM tasks WHERE id=?', [task.id])[0] });
});

router.delete('/:id', auth, (req, res) => {
  const task = query('SELECT * FROM tasks WHERE id=?', [req.params.id])[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  run('DELETE FROM tasks WHERE id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// Team tasks
router.get('/team/:teamId', auth, teamRole, (req, res) => {
  const tasks = query(
    'SELECT t.*, u.username, u.profile_image FROM tasks t JOIN users u ON u.id=t.user_id WHERE t.team_id=? ORDER BY t.created_at DESC',
    [req.params.teamId]
  );
  res.json({ tasks });
});

export default router;