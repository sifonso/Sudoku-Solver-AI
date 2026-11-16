// Schichttypen, mit denen ein neuer Betrieb startet. Änderbar unter S06.
export const DEFAULT_SHIFT_TYPES = [
  { name: 'Frühschicht', startTime: '06:00', endTime: '14:00', weekdays: [1, 2, 3, 4, 5], minStaff: 1, qualificationIds: [] as string[] },
  { name: 'Spätschicht', startTime: '14:00', endTime: '22:00', weekdays: [1, 2, 3, 4, 5], minStaff: 1, qualificationIds: [] as string[] },
];
