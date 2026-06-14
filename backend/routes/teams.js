import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, run } from '../db.js';
import { auth, optionalAuth, teamRole } from '../middleware.js';

const router = Router();

const TEAM_CATEGORIES = ['general','productivity','study','work','gaming','social'];
const MAX_TEAMS_CREATED = 3;
const MAX_TEAMS_JOINED  = 10;

router.get('/', optionalAuth, (req, res) => {
  const { category, limit } = req.query;
  const filter = category ? `WHERE t.category=?` : '';
  const params = category ? [category] : [];
  const teams = query(`
    SELECT t.*, COUNT(tm.user_id) as member_count, u.username as creator_name
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id=t.id
    LEFT JOIN users u ON u.id=t.created_by
    ${filter} GROUP BY t.id
    ORDER BY member_count DESC, t.created_at DESC
    ${limit ? `LIMIT ${parseInt(limit)}` : ''}
  `, params);

  const teamsWithMembers = teams.map(team => {
    const members = query(`
      SELECT u.id, u.username, u.profile_image, tm.role, COUNT(s.id) as sessions
      FROM team_members tm JOIN users u ON u.id=tm.user_id
      LEFT JOIN sessions s ON s.user_id=u.id
      WHERE tm.team_id=? GROUP BY u.id ORDER BY sessions DESC
    `, [team.id]);
    return { ...team, members };
  });
  res.json({ teams: teamsWithMembers });
});

router.get('/:teamId', optionalAuth, (req, res) => {
  const team = query(
    'SELECT t.*, COUNT(tm.user_id) as member_count FROM teams t LEFT JOIN team_members tm ON tm.team_id=t.id WHERE t.id=? GROUP BY t.id',
    [req.params.teamId]
  )[0];
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const members = query(`
    SELECT u.id, u.username, u.profile_image, tm.role, COUNT(s.id) as sessions
    FROM team_members tm JOIN users u ON u.id=tm.user_id
    LEFT JOIN sessions s ON s.user_id=u.id
    WHERE tm.team_id=? GROUP BY u.id
    ORDER BY CASE tm.role WHEN 'leader' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, sessions DESC
  `, [req.params.teamId]);
  res.json({ team: { ...team, members } });
});

router.post('/', auth, (req, res) => {
  const { name, color = '#f97316', category = 'general' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  if (!TEAM_CATEGORIES.includes(category))
    return res.status(400).json({ error: `Invalid category. Use: ${TEAM_CATEGORIES.join(', ')}` });

  const created = query('SELECT COUNT(*) as c FROM teams WHERE created_by=?', [req.user.id])[0]?.c ?? 0;
  if (created >= MAX_TEAMS_CREATED)
    return res.status(403).json({ error: `You can only create up to ${MAX_TEAMS_CREATED} teams` });

  const joined = query('SELECT COUNT(*) as c FROM team_members WHERE user_id=?', [req.user.id])[0]?.c ?? 0;
  if (joined >= MAX_TEAMS_JOINED)
    return res.status(403).json({ error: `You can only join up to ${MAX_TEAMS_JOINED} teams` });

  if (query('SELECT id FROM teams WHERE name=?', [name.trim()]).length)
    return res.status(409).json({ error: 'Team name already taken' });

  const code = name.trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5) + Math.random().toString(36).slice(2,5).toUpperCase();
  const id = randomUUID();
  run('INSERT INTO teams (id, name, color, category, invite_code, created_by) VALUES (?,?,?,?,?,?)',
    [id, name.trim(), color, category, code, req.user.id]);
  run('INSERT INTO team_members (team_id, user_id, role) VALUES (?,?,?)', [id, req.user.id, 'leader']);
  res.json({ team: query('SELECT * FROM teams WHERE id=?', [id])[0], invite_code: code });
});

router.post('/join', auth, (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' });

  const team = query('SELECT * FROM teams WHERE invite_code=?', [invite_code.toUpperCase()])[0];
  if (!team) return res.status(404).json({ error: 'Invalid invite code' });

  if (query('SELECT * FROM team_members WHERE team_id=? AND user_id=?', [team.id, req.user.id]).length)
    return res.status(409).json({ error: 'Already a member of this team' });

  const joined = query('SELECT COUNT(*) as c FROM team_members WHERE user_id=?', [req.user.id])[0]?.c ?? 0;
  if (joined >= MAX_TEAMS_JOINED)
    return res.status(403).json({ error: `You can only join up to ${MAX_TEAMS_JOINED} teams` });

  run('INSERT INTO team_members (team_id, user_id, role) VALUES (?,?,?)', [team.id, req.user.id, 'member']);
  res.json({ team, message: 'Joined team' });
});

router.delete('/:teamId/leave', auth, teamRole, (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;
  if (req.teamRole === 'leader') {
    const others = query('SELECT user_id FROM team_members WHERE team_id=? AND user_id!=?', [teamId, userId]);
    if (others.length === 0) {
      run('DELETE FROM tasks WHERE team_id=?', [teamId]);
      run('DELETE FROM team_members WHERE team_id=?', [teamId]);
      run('DELETE FROM teams WHERE id=?', [teamId]);
      return res.json({ message: 'Team deleted (you were the only member)' });
    }
    return res.status(400).json({ error: 'Transfer leadership before leaving the team', code: 'TRANSFER_REQUIRED' });
  }
  run('DELETE FROM team_members WHERE team_id=? AND user_id=?', [teamId, userId]);
  res.json({ message: 'Left team' });
});

router.post('/:teamId/transfer', auth, teamRole, (req, res) => {
  if (req.teamRole !== 'leader') return res.status(403).json({ error: 'Only the team leader can transfer leadership' });
  const { new_leader_id } = req.body;
  if (!new_leader_id) return res.status(400).json({ error: 'new_leader_id required' });
  const target = query('SELECT * FROM team_members WHERE team_id=? AND user_id=?', [req.params.teamId, new_leader_id])[0];
  if (!target) return res.status(404).json({ error: 'Target user is not a team member' });
  run('UPDATE team_members SET role=? WHERE team_id=? AND user_id=?', ['member', req.params.teamId, req.user.id]);
  run('UPDATE team_members SET role=? WHERE team_id=? AND user_id=?', ['leader', req.params.teamId, new_leader_id]);
  res.json({ message: 'Leadership transferred' });
});

router.delete('/:teamId', auth, teamRole, (req, res) => {
  if (req.teamRole !== 'leader') return res.status(403).json({ error: 'Only the team leader can delete the team' });
  run('DELETE FROM tasks WHERE team_id=?', [req.params.teamId]);
  run('DELETE FROM team_members WHERE team_id=?', [req.params.teamId]);
  run('DELETE FROM teams WHERE id=?', [req.params.teamId]);
  res.json({ message: 'Team deleted' });
});

router.patch('/:teamId/members/:userId/role', auth, teamRole, (req, res) => {
  const { role } = req.body;
  if (!['moderator','member'].includes(role)) return res.status(400).json({ error: 'role must be moderator or member' });
  if (req.teamRole !== 'leader') return res.status(403).json({ error: 'Only the leader can change roles' });
  if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });
  const target = query('SELECT * FROM team_members WHERE team_id=? AND user_id=?', [req.params.teamId, req.params.userId])[0];
  if (!target) return res.status(404).json({ error: 'Member not found' });
  if (target.role === 'leader') return res.status(400).json({ error: 'Cannot demote another leader — transfer first' });
  run('UPDATE team_members SET role=? WHERE team_id=? AND user_id=?', [role, req.params.teamId, req.params.userId]);
  res.json({ message: `Role updated to ${role}` });
});

router.delete('/:teamId/members/:userId', auth, teamRole, (req, res) => {
  const targetId = req.params.userId;
  if (targetId === req.user.id) return res.status(400).json({ error: 'Use the leave endpoint to leave' });
  const target = query('SELECT * FROM team_members WHERE team_id=? AND user_id=?', [req.params.teamId, targetId])[0];
  if (!target) return res.status(404).json({ error: 'Member not found' });
  if (req.teamRole === 'moderator' && target.role !== 'member')
    return res.status(403).json({ error: 'Moderators can only kick regular members' });
  if (req.teamRole === 'member') return res.status(403).json({ error: 'Insufficient permissions' });
  run('DELETE FROM team_members WHERE team_id=? AND user_id=?', [req.params.teamId, targetId]);
  res.json({ message: 'Member removed' });
});

export default router;