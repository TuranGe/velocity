// Shared "last 7 days" stats computation.
//
// Both the Weekly Recap modal and the shareable stats card describe
// themselves as a "weekly" summary, so they should always show the
// same numbers. Previously each computed its own version (slightly
// different rounding, different data sources), which could show two
// different "weekly" totals for the same person. This module is the
// single source of truth for that 7-day window.

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * @param {Array<{sessions?: number, total_seconds?: number}>} daily
 *   Last-7-days array as returned by GET /api/sessions/me (`daily`),
 *   oldest first, ending with today.
 * @param {Array<{done?: boolean, doneAt?: number, createdAt?: number}>} tasks
 *   Local tasks store contents.
 * @param {number} currentStreak
 * @returns {{
 *   totalMinutes: number,
 *   totalSessions: number,
 *   activeDays: number,
 *   bestDayMinutes: number,
 *   tasksCompleted: number,
 *   totalHours: string,
 *   chartDays: Array<{label: string, minutes: number, isToday: boolean}>,
 *   currentStreak: number,
 * }}
 */
export function computeWeeklyStats(daily = [], tasks = [], currentStreak = 0) {
  const days = Array.from({ length: 7 }, (_, i) => daily[i] || { sessions: 0, total_seconds: 0 });

  const totalSeconds = days.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const totalSessions = days.reduce((sum, d) => sum + (d.sessions || 0), 0);
  const activeDays = days.filter(d => (d.sessions || 0) > 0).length;
  const bestDayMinutes = Math.round(Math.max(0, ...days.map(d => d.total_seconds || 0)) / 60);

  const weekAgo = Date.now() - 7 * 86400000;
  const tasksCompleted = tasks.filter(t => t.done && (t.doneAt ?? t.createdAt ?? 0) >= weekAgo).length;

  const today = new Date();
  const chartDays = days.map((d, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - i));
    return {
      label: DAY_LABELS[date.getDay()],
      isToday: i === 6,
      sessions: d.sessions || 0,
      minutes: Math.round((d.total_seconds || 0) / 60),
    };
  });

  return {
    totalMinutes,
    totalSessions,
    activeDays,
    bestDayMinutes,
    tasksCompleted,
    totalHours: (totalMinutes / 60).toFixed(1),
    chartDays,
    currentStreak,
  };
}