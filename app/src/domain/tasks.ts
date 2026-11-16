// Welche Aufgaben gehören zu einer Schicht? Gleiche Regel in Fake- und Supabase-Datenschicht.
import { isoWeekday } from './time.ts';
import type { Assignment, Shift, Task } from './types.ts';

export function tasksForShift(tasks: Task[], shift: Pick<Shift, 'id' | 'shiftTypeId' | 'date'>, assignments: Pick<Assignment, 'id' | 'shiftId'>[]): Task[] {
  const wd = isoWeekday(shift.date);
  const assignmentIds = new Set(assignments.filter((a) => a.shiftId === shift.id).map((a) => a.id));
  return tasks
    .filter((t) => !t.deletedAt)
    .filter((t) =>
      t.kind === 'special'
        ? !!t.assignmentId && assignmentIds.has(t.assignmentId)
        : !!shift.shiftTypeId && t.shiftTypeIds.includes(shift.shiftTypeId) && (t.weekdays == null || t.weekdays.includes(wd)))
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, 'de'));
}
