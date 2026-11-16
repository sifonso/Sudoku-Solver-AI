-- Interne Nutzung ohne Bezahlfunktion (Entscheidung 2026-11-16).
-- Neuer Tarif 'internal' ohne Testphase und ohne Personenlimit; Standard für neue Betriebe.
-- Das Limit von 10 Personen (enforce_member_limit) gilt weiter nur für 'trial'.
alter table tenants drop constraint tenants_plan_check;
alter table tenants add constraint tenants_plan_check
  check (plan in ('internal','trial','basic','professional','enterprise'));
alter table tenants alter column plan set default 'internal';
alter table tenants alter column trial_ends_at drop not null;
alter table tenants alter column trial_ends_at drop default;
update tenants set plan = 'internal', trial_ends_at = null where plan = 'trial';
