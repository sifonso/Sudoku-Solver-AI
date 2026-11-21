-- Regeln je Person für die Autodisposition (gesundheitliche Einschränkungen, Vorlieben).
-- Liegen bei der Personalnummer: nur FK4/SL und Planer können sie lesen und schreiben.
alter table dp_staff_private add column rules jsonb not null default '{}'::jsonb;
