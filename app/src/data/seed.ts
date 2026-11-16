// Demodaten für die Fake-Datenschicht. Namen und Betrieb sind erfunden.
import { addDays, shiftBounds, startOfWeek, today } from '../domain/time';
import type { Absence, Assignment, Member, Qualification, Shift, ShiftType, Tenant, VacationBlock } from '../domain/types';

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_USERS = [
  { id: 'u-chef', email: 'chef@demo.de', label: 'Chef (Jana Wilke)' },
  { id: 'u-mira', email: 'mira@demo.de', label: 'Mitarbeiterin (Mira Okafor)' },
] as const;

export interface DB {
  users: { id: string; email: string; password: string }[];
  tenants: Tenant[];
  members: Member[];
  qualifications: Qualification[];
  shiftTypes: ShiftType[];
  shifts: Shift[];
  assignments: Assignment[];
  absences: Absence[];
  vacationBlocks: VacationBlock[];
  quickFolders: import('../domain/types').QuickFolder[];
  quickActions: import('../domain/types').QuickAction[];
  quickEntries: import('../domain/types').QuickEntry[];
  tasks: import('../domain/types').Task[];
  completions: import('../domain/types').TaskCompletion[];
  swaps: { id: string; tenantId: string; assignmentId: string; offeredBy: string; status: import('../domain/types').SwapStatus; chosenMemberId: string | null; applicantIds: string[]; expiresAt: string | null; createdAt: string }[];
  notifications: import('../domain/types').AppNotification[];
}

export function seed(now: number = Date.now()): DB {
  const tz = 'Europe/Berlin';
  const T = 't-morgenrot';
  const tenant: Tenant = {
    id: T, slug: 'cafe-morgenrot', name: 'Café Morgenrot', timezone: tz, plan: 'internal',
    trialEndsAt: null, minRestHours: 11,
    swapRequiresApproval: true, employeesSeeFullPlan: true, workdays: [1, 2, 3, 4, 5, 6],
  };
  const q = { id: 'q-erste-hilfe', tenantId: T, name: 'Ersthelfer' };
  const m = (id: string, displayName: string, initials: string, employmentType: Member['employmentType'],
    role: Member['role'] = 'mitarbeiter', userId: string | null = null, limit: number | null = null, quals: string[] = []): Member =>
    ({ id, tenantId: T, userId, displayName, initials, role, employmentType, status: 'active', monthlyHoursLimit: limit,
      vacationDaysPerYear: employmentType === 'vollzeit' ? 28 : employmentType === 'teilzeit' ? 20 : null, qualificationIds: quals });
  const members = [
    m('m-jana', 'Jana Wilke', 'JW', 'vollzeit', 'chef', 'u-chef', null, [q.id]),
    m('m-lena', 'Lena Kraus', 'LK', 'vollzeit'),
    m('m-sofia', 'Sofia Reyes', 'SR', 'vollzeit', 'mitarbeiter', null, null, [q.id]),
    m('m-tom', 'Tom Sander', 'TS', 'teilzeit'),
    m('m-mira', 'Mira Okafor', 'MO', 'aushilfe', 'mitarbeiter', 'u-mira', 40),
    m('m-paul', 'Paul Brandt', 'PB', 'aushilfe', 'mitarbeiter', null, 40),
  ];
  const st = (id: string, name: string, startTime: string, endTime: string, weekdays: number[], minStaff: number, sort: number, quals: string[] = []): ShiftType =>
    ({ id, tenantId: T, name, startTime, endTime, weekdays, minStaff, qualificationIds: quals, sort });
  const shiftTypes = [
    st('st-frueh', 'Frühschicht', '06:00', '14:00', [1, 2, 3, 4, 5, 6], 2, 1),
    st('st-spaet', 'Spätschicht', '14:00', '22:00', [1, 2, 3, 4, 5, 6], 2, 2),
    st('st-nacht', 'Nachtschicht', '22:00', '06:00', [5, 6], 1, 3, [q.id]),
    st('st-sonntag', 'Sonntagsdienst', '09:00', '17:00', [7], 1, 4),
  ];

  const week = startOfWeek(today(tz, now));
  const shifts: Shift[] = [];
  const assignments: Assignment[] = [];
  const plan: [number, string, string[]][] = [
    [0, 'st-frueh', ['m-lena', 'm-mira']], [0, 'st-spaet', ['m-tom', 'm-sofia']],
    [1, 'st-frueh', ['m-lena', 'm-paul']], [1, 'st-spaet', ['m-sofia']],
    [2, 'st-frueh', ['m-lena']], [2, 'st-spaet', ['m-tom', 'm-mira']],
    [3, 'st-frueh', ['m-sofia', 'm-paul']], [3, 'st-spaet', ['m-lena', 'm-tom']],
    [4, 'st-frueh', ['m-lena', 'm-mira']], [4, 'st-spaet', ['m-tom']], [4, 'st-nacht', ['m-sofia']],
    [5, 'st-frueh', ['m-paul']], [5, 'st-nacht', ['m-jana']],
    [7, 'st-frueh', ['m-lena', 'm-mira']], [8, 'st-spaet', ['m-mira']],
  ];
  for (const [offset, typeId, who] of plan) {
    const type = shiftTypes.find((s) => s.id === typeId)!;
    const date = addDays(week, offset);
    const b = shiftBounds(date, type.startTime, type.endTime, tz);
    const shift: Shift = { id: `s-${typeId}-${date}`, tenantId: T, shiftTypeId: typeId, date, name: null, minStaff: type.minStaff, ...b };
    shifts.push(shift);
    for (const memberId of who) {
      assignments.push({ id: `a-${shift.id}-${memberId}`, tenantId: T, shiftId: shift.id, memberId, ...b });
    }
  }
  const absences: Absence[] = [
    { id: 'ab-tom', tenantId: T, memberId: 'm-tom', kind: 'vacation', startDate: addDays(week, 5), endDate: addDays(week, 9), status: 'approved', comment: null, createdAt: new Date(now - 7 * 86_400_000).toISOString() },
    { id: 'ab-lena', tenantId: T, memberId: 'm-lena', kind: 'vacation', startDate: addDays(week, 21), endDate: addDays(week, 25), status: 'requested', comment: 'Hochzeit meiner Schwester', createdAt: new Date(now - 86_400_000).toISOString() },
  ];
  const vacationBlocks: VacationBlock[] = [
    { id: 'vb-advent', tenantId: T, startDate: `${today(tz, now).slice(0, 4)}-12-14`, endDate: `${today(tz, now).slice(0, 4)}-12-24`, reason: 'Weihnachtsgeschäft' },
  ];
  return {
    users: DEMO_USERS.map((u) => ({ id: u.id, email: u.email, password: DEMO_PASSWORD })),
    tenants: [tenant], members, qualifications: [q], shiftTypes, shifts, assignments, absences, vacationBlocks, notifications: [],
    tasks: [
      { id: 'tk-kasse', tenantId: T, title: 'Kasse zählen und Bericht ablegen', description: null, kind: 'standard', assignmentId: null, shiftTypeIds: ['st-frueh', 'st-spaet'], weekdays: null, priority: 2, deletedAt: null, completionCount: 0 },
      { id: 'tk-kuehl', tenantId: T, title: 'Kühlvitrine auswischen', description: 'Innen und Dichtungen, danach Temperatur prüfen.', kind: 'standard', assignmentId: null, shiftTypeIds: ['st-spaet'], weekdays: [3, 6], priority: 1, deletedAt: null, completionCount: 0 },
      { id: 'tk-terrasse', tenantId: T, title: 'Terrassenmöbel abdecken', description: null, kind: 'standard', assignmentId: null, shiftTypeIds: ['st-spaet'], weekdays: null, priority: 0, deletedAt: '2026-10-01T00:00:00Z', completionCount: 0 },
    ],
    completions: [],
    quickFolders: [{ id: 'qf-reinigung', tenantId: T, name: 'Reinigung', pair: 'moos', sort: 2 }],
    quickActions: [
      { id: 'qa-kuehl', tenantId: T, folderId: null, name: 'Kühlung', icon: 'thermometer', pair: 'orange', sort: 1, archivedAt: null,
        reminderTimes: ['08:00', '16:00'],
        fields: [
          { key: 'k1', label: 'Kühlhaus 1', type: 'number', unit: '°C', min: 0, max: 7, required: true },
          { key: 'k2', label: 'Kühlvitrine', type: 'number', unit: '°C', min: 0, max: 7, required: true },
          { key: 'tk', label: 'Tiefkühler', type: 'number', unit: '°C', min: -25, max: -18, required: true },
          { key: 'notiz', label: 'Bemerkung', type: 'text' },
        ] },
      { id: 'qa-inventur', tenantId: T, folderId: null, name: 'Inventur Getränke', icon: 'package', pair: 'lavender', sort: 3, archivedAt: null,
        reminderTimes: [],
        fields: [
          { key: 'wasser', label: 'Wasser 0,75 l', type: 'number', unit: 'Fl.', min: 0 },
          { key: 'saft', label: 'Apfelschorle', type: 'number', unit: 'Fl.', min: 0 },
        ] },
      { id: 'qa-theke', tenantId: T, folderId: 'qf-reinigung', name: 'Theke desinfiziert', icon: 'sparkles', pair: 'moos', sort: 1, archivedAt: null,
        reminderTimes: [], fields: [{ key: 'ok', label: 'Erledigt', type: 'check', required: true }] },
      { id: 'qa-boden', tenantId: T, folderId: 'qf-reinigung', name: 'Boden gewischt', icon: 'droplets', pair: 'moos', sort: 2, archivedAt: null,
        reminderTimes: [], fields: [{ key: 'ok', label: 'Erledigt', type: 'check', required: true }] },
    ],
    quickEntries: [],
    // Lena bietet ihre Spätschicht am Donnerstag dieser Woche zum Tausch an.
    swaps: [{ id: 'sw-lena', tenantId: T, assignmentId: `a-s-st-spaet-${addDays(week, 3)}-m-lena`, offeredBy: 'm-lena', status: 'open', chosenMemberId: null, applicantIds: [], expiresAt: null, createdAt: new Date(now - 3_600_000).toISOString() }],
  };
}
