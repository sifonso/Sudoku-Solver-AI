-- Schichtenmanager-Rebuild: erste Migration (Supabase / Postgres 15+)
-- Zugriff: Row Level Security auf jeder Tabelle. Schreibvorgänge mit
-- Geschäftsregeln laufen über security-definer-Funktionen (RPC).
-- Zeiten: timestamptz in UTC; lokale Schichtzeiten als time + tenants.timezone.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Mandanten und Mitglieder
-- ---------------------------------------------------------------------------

create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null check (length(name) between 1 and 120),
  timezone text not null default 'Europe/Berlin',
  plan text not null default 'trial'
    check (plan in ('trial','basic','professional','enterprise')),
  status text not null default 'active'
    check (status in ('active','restricted','cancelled')),
  trial_ends_at timestamptz not null default now() + interval '14 days',
  -- Einstellungen
  swap_requires_approval boolean not null default true,
  employees_see_full_plan boolean not null default true,
  min_rest_hours numeric(4,1) not null default 11 check (min_rest_hours between 0 and 24),
  workdays smallint[] not null default '{1,2,3,4,5}',      -- ISO: 1 = Mo, 7 = So
  brand_color text check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_path text,
  -- Abrechnung
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tenants_updated before update on tenants
  for each row execute function set_updated_at();

create table members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,   -- null = eingeladen, noch nicht beigetreten
  display_name text not null check (length(display_name) between 1 and 80),
  initials text not null check (length(initials) between 1 and 4),
  color text not null default '#4F7FE8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  role text not null default 'mitarbeiter'
    check (role in ('chef','planer','aufgaben_manager','mitarbeiter')),
  employment_type text not null default 'vollzeit'
    check (employment_type in ('vollzeit','teilzeit','aushilfe')),
  status text not null default 'invited'
    check (status in ('invited','active','locked','archived')),
  fixed_shift_type_id uuid,                                   -- FK unten, nach shift_types
  weekly_hours_target numeric(5,2) check (weekly_hours_target >= 0),
  monthly_hours_limit numeric(6,2) check (monthly_hours_limit >= 0),   -- z.B. Minijob
  vacation_days_per_year numeric(4,1) check (vacation_days_per_year >= 0),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index on members (tenant_id, status);
create index on members (user_id);
create unique index members_initials_unique on members (tenant_id, initials)
  where status <> 'archived';
create trigger members_updated before update on members
  for each row execute function set_updated_at();

-- Kontaktdaten getrennt, damit Mitarbeiter Namen/Kürzel der Kollegen sehen,
-- aber keine E-Mail-Adressen oder Telefonnummern.
create table member_contacts (
  member_id uuid primary key references members(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text,
  phone text,
  updated_at timestamptz not null default now()
);
create index on member_contacts (tenant_id);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  email text not null,
  token_hash text not null unique,                 -- sha256 des Einladungstokens
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on invitations (tenant_id);
create index on invitations (member_id);

-- Rollen-Helfer für RLS. security definer, damit die Policies auf members
-- nicht rekursiv auf members-Policies laufen.
create or replace function has_role(t uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members m
    where m.tenant_id = t and m.user_id = auth.uid()
      and m.status = 'active' and m.role = any (roles)
  )
$$;

create or replace function is_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(t, array['chef','planer','aufgaben_manager','mitarbeiter'])
$$;

create or replace function my_member_id(t uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m.id from members m
  where m.tenant_id = t and m.user_id = auth.uid() and m.status = 'active'
$$;

create or replace function can_plan(t uuid) returns boolean
language sql stable as $$ select has_role(t, array['chef','planer']) $$;

-- ---------------------------------------------------------------------------
-- Stammdaten
-- ---------------------------------------------------------------------------

create table locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);
create trigger locations_updated before update on locations
  for each row execute function set_updated_at();

create table qualifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);
create trigger qualifications_updated before update on qualifications
  for each row execute function set_updated_at();

create table member_qualifications (
  member_id uuid not null references members(id) on delete cascade,
  qualification_id uuid not null references qualifications(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  valid_until date,
  created_at timestamptz not null default now(),
  primary key (member_id, qualification_id)
);
create index on member_qualifications (qualification_id);
create index on member_qualifications (tenant_id);

create table availabilities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  weekday smallint check (weekday between 1 and 7),   -- wiederkehrend ...
  on_date date,                                       -- ... oder an einem Datum
  start_time time not null,
  end_time time not null,
  kind text not null check (kind in ('available','unavailable','preferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_of_weekday_or_date check ((weekday is null) <> (on_date is null))
);
create index on availabilities (member_id);
create index on availabilities (tenant_id, on_date);
create trigger availabilities_updated before update on availabilities
  for each row execute function set_updated_at();

create table shift_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  name text not null check (length(name) between 1 and 80),
  start_time time not null,
  end_time time not null,          -- end_time <= start_time heißt: endet am Folgetag
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}',
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  min_staff smallint not null default 1 check (min_staff >= 0),
  sort integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on shift_types (tenant_id);
create index on shift_types (location_id);
create trigger shift_types_updated before update on shift_types
  for each row execute function set_updated_at();

alter table members add constraint members_fixed_shift_type_fk
  foreign key (fixed_shift_type_id) references shift_types(id) on delete set null;
create index on members (fixed_shift_type_id);

create table shift_type_qualifications (
  shift_type_id uuid not null references shift_types(id) on delete cascade,
  qualification_id uuid not null references qualifications(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  primary key (shift_type_id, qualification_id)
);
create index on shift_type_qualifications (qualification_id);
create index on shift_type_qualifications (tenant_id);

-- ---------------------------------------------------------------------------
-- Plan
-- ---------------------------------------------------------------------------

-- Eine Schicht = ein Schichttyp an einem Datum (oder eine Sonderschicht ohne Typ).
-- start_at/end_at werden beim Anlegen aus Typ + Datum + Zeitzone berechnet,
-- damit Sommer-/Winterzeit einmal korrekt aufgelöst und danach gespeichert ist.
create table shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  shift_type_id uuid references shift_types(id) on delete restrict,
  location_id uuid references locations(id) on delete set null,
  date date not null,                                  -- lokales Startdatum
  name text,                                           -- nur Sonderschicht
  start_at timestamptz not null,
  end_at timestamptz not null,
  min_staff smallint not null default 1 check (min_staff >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_positive check (end_at > start_at),
  constraint special_has_name check (shift_type_id is not null or name is not null)
);
create unique index shifts_type_date_unique on shifts (shift_type_id, date)
  where shift_type_id is not null;
create index on shifts (tenant_id, date);
create index on shifts (location_id);
create trigger shifts_updated before update on shifts
  for each row execute function set_updated_at();

create table assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  member_id uuid not null references members(id) on delete restrict,  -- Historie: archivieren statt löschen
  start_at timestamptz not null,       -- Kopie der Schichtzeit, per "Zeiten bearbeiten" änderbar
  end_at timestamptz not null,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_positive check (end_at > start_at),
  unique (shift_id, member_id),
  -- Harte Regel: niemand ist zweimal gleichzeitig eingeteilt.
  constraint no_double_booking exclude using gist (
    member_id with =, tstzrange(start_at, end_at, '[)') with &&
  )
);
create index on assignments (tenant_id, start_at);
create index on assignments (member_id, start_at);
create index on assignments (created_by);
create trigger assignments_updated before update on assignments
  for each row execute function set_updated_at();

create table shift_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);
create trigger shift_templates_updated before update on shift_templates
  for each row execute function set_updated_at();

create table shift_template_entries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references shift_templates(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  shift_type_id uuid not null references shift_types(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on shift_template_entries (template_id);
create index on shift_template_entries (tenant_id);
create index on shift_template_entries (shift_type_id);
create index on shift_template_entries (member_id);

create table handover_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  author_id uuid not null references members(id) on delete restrict,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on handover_notes (shift_id);
create index on handover_notes (tenant_id);
create index on handover_notes (author_id);

-- ---------------------------------------------------------------------------
-- Abwesenheiten
-- ---------------------------------------------------------------------------

create table absences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references members(id) on delete restrict,
  kind text not null check (kind in ('vacation','sick')),
  start_date date not null,
  end_date date not null,
  status text not null default 'requested'
    check (status in ('requested','approved','rejected','cancelled')),
  comment text,
  decided_by uuid references members(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint absence_range check (end_date >= start_date),
  -- Keine zwei offenen/genehmigten Abwesenheiten desselben Mitarbeiters überlappen.
  constraint no_overlapping_absence exclude using gist (
    member_id with =, daterange(start_date, end_date, '[]') with &&
  ) where (status in ('requested','approved'))
);
create index on absences (tenant_id, status, start_date);
create index on absences (member_id, start_date);
create index on absences (decided_by);
create trigger absences_updated before update on absences
  for each row execute function set_updated_at();

create table vacation_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint block_range check (end_date >= start_date)
);
create index on vacation_blocks (tenant_id, start_date);

-- ---------------------------------------------------------------------------
-- Schichttausch
-- ---------------------------------------------------------------------------

create table swap_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  assignment_id uuid not null references assignments(id) on delete cascade,
  offered_by uuid not null references members(id) on delete cascade,
  status text not null default 'open'
    check (status in ('open','pending_approval','approved','rejected','cancelled','expired')),
  chosen_member_id uuid references members(id) on delete set null,
  decided_by uuid references members(id) on delete set null,
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index swap_one_active_per_assignment on swap_requests (assignment_id)
  where status in ('open','pending_approval');
create index on swap_requests (tenant_id, status);
create index on swap_requests (offered_by);
create index on swap_requests (chosen_member_id);
create index on swap_requests (decided_by);
create trigger swap_requests_updated before update on swap_requests
  for each row execute function set_updated_at();

create table swap_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  swap_request_id uuid not null references swap_requests(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (swap_request_id, member_id)
);
create index on swap_applications (member_id);
create index on swap_applications (tenant_id);

-- ---------------------------------------------------------------------------
-- Aufgaben
-- ---------------------------------------------------------------------------

create table tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  description text,
  kind text not null check (kind in ('standard','special')),
  assignment_id uuid references assignments(id) on delete cascade,  -- nur Sonderaufgabe
  weekdays smallint[],                 -- null = an jedem Tag der Schicht
  priority smallint not null default 1 check (priority between 0 and 2),
  due_time time,
  deleted_at timestamptz,              -- "Gelöschte anzeigen"
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_needs_assignment check ((kind = 'special') = (assignment_id is not null))
);
create index on tasks (tenant_id, kind) where deleted_at is null;
create index on tasks (assignment_id);
create index on tasks (created_by);
create trigger tasks_updated before update on tasks
  for each row execute function set_updated_at();

create table task_shift_types (
  task_id uuid not null references tasks(id) on delete cascade,
  shift_type_id uuid not null references shift_types(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  primary key (task_id, shift_type_id)
);
create index on task_shift_types (shift_type_id);
create index on task_shift_types (tenant_id);

-- id wird auf dem Gerät erzeugt: ein offline erledigter Haken, der zweimal
-- hochgeladen wird, landet nur einmal in der Tabelle.
create table task_completions (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  member_id uuid not null references members(id) on delete restrict,
  completed_at timestamptz not null,   -- Gerätezeit
  created_at timestamptz not null default now(),
  unique (task_id, shift_id)
);
create index on task_completions (tenant_id, completed_at);
create index on task_completions (shift_id);
create index on task_completions (member_id);

-- ---------------------------------------------------------------------------
-- Schnellaktionen
-- ---------------------------------------------------------------------------

create table quick_action_folders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  icon text,
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on quick_action_folders (tenant_id);
create trigger quick_action_folders_updated before update on quick_action_folders
  for each row execute function set_updated_at();

-- fields: [{ "key": "temp", "label": "Kühlhaus 1", "type": "number", "unit": "°C",
--            "min": 0, "max": 7, "required": true }, ...]
create table quick_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  folder_id uuid references quick_action_folders(id) on delete set null,
  name text not null,
  icon text,
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  fields jsonb not null default '[]' check (jsonb_typeof(fields) = 'array'),
  reminder_times time[] not null default '{}',
  sort integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on quick_actions (tenant_id);
create index on quick_actions (folder_id);
create trigger quick_actions_updated before update on quick_actions
  for each row execute function set_updated_at();

create table quick_action_entries (
  id uuid primary key,                 -- Geräte-UUID, siehe task_completions
  tenant_id uuid not null references tenants(id) on delete cascade,
  quick_action_id uuid not null references quick_actions(id) on delete restrict,
  member_id uuid not null references members(id) on delete restrict,
  "values" jsonb not null check (jsonb_typeof("values") = 'object'),
  out_of_range boolean not null default false,
  recorded_at timestamptz not null,    -- Gerätezeit
  created_at timestamptz not null default now()
);
create index on quick_action_entries (quick_action_id, recorded_at);
create index on quick_action_entries (tenant_id, recorded_at);
create index on quick_action_entries (member_id);

create table quick_action_reminders_sent (
  quick_action_id uuid not null references quick_actions(id) on delete cascade,
  remind_at timestamptz not null,
  primary key (quick_action_id, remind_at)
);

-- ---------------------------------------------------------------------------
-- Benachrichtigungen
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  type text not null,      -- shift_assigned, shift_changed, swap_*, absence_*, task_new, reminder ...
  title text not null,
  body text,
  data jsonb not null default '{}',
  read_at timestamptz,
  pushed_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (member_id, created_at desc);
create index on notifications (tenant_id);
create index on notifications (created_at) where pushed_at is null;

create table notification_preferences (
  member_id uuid not null references members(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null,
  push boolean not null default true,
  email boolean not null default false,
  primary key (member_id, type)
);
create index on notification_preferences (tenant_id);

create table tenant_notification_defaults (
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null,
  push boolean not null default true,
  email boolean not null default false,
  primary key (tenant_id, type)
);

create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios','android','web')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on device_tokens (user_id);

-- Stripe-Webhooks kommen mehrfach an: Event-ID merken, zweites Mal ignorieren.
create table stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Trigger mit Geschäftsregeln
-- ---------------------------------------------------------------------------

-- Trial: höchstens 10 aktive Mitarbeiter (Preisseite des Originals).
create or replace function enforce_member_limit() returns trigger
language plpgsql as $$
declare
  v_plan text;
  v_count int;
begin
  if new.status not in ('invited','active') then
    return new;
  end if;
  select plan into v_plan from tenants where id = new.tenant_id;
  if v_plan = 'trial' then
    select count(*) into v_count from members
      where tenant_id = new.tenant_id and status in ('invited','active') and id <> new.id;
    if v_count >= 10 then
      raise exception 'member_limit_reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger members_limit before insert or update of status on members
  for each row execute function enforce_member_limit();

-- Zuweisung übernimmt die Schichtzeit, wenn keine eigene angegeben ist,
-- und muss im selben Mandanten wie Schicht und Mitarbeiter liegen.
create or replace function assignment_defaults() returns trigger
language plpgsql as $$
declare
  s shifts;
begin
  select * into s from shifts where id = new.shift_id;
  if s.tenant_id <> new.tenant_id
     or not exists (select 1 from members where id = new.member_id and tenant_id = new.tenant_id) then
    raise exception 'tenant_mismatch' using errcode = 'P0001';
  end if;
  new.start_at := coalesce(new.start_at, s.start_at);
  new.end_at := coalesce(new.end_at, s.end_at);
  return new;
end $$;
create trigger assignments_defaults before insert on assignments
  for each row execute function assignment_defaults();

-- Mitteilung an den Mitarbeiter, wenn er eingeteilt oder ausgetragen wird
-- (löst über den Database Webhook den Push aus). Nicht, wenn er es selbst war.
-- Text bewusst ohne Gesundheits- oder Abwesenheitsbezug.
create or replace function notify_assignment_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a assignments := coalesce(new, old);
  s shifts;
  st_name text;
  tz text;
  v_actor uuid;
begin
  select * into s from shifts where id = a.shift_id;
  if s.id is null then
    return null;  -- Schicht wurde mitgelöscht (cascade)
  end if;
  select name into st_name from shift_types where id = s.shift_type_id;
  select timezone into tz from tenants where id = a.tenant_id;
  v_actor := my_member_id(a.tenant_id);
  if v_actor is not null and v_actor = a.member_id then
    return null;
  end if;
  insert into notifications (tenant_id, member_id, type, title, body, data)
  values (
    a.tenant_id, a.member_id,
    case when tg_op = 'INSERT' then 'shift_assigned' else 'shift_removed' end,
    case when tg_op = 'INSERT' then 'Neue Schicht' else 'Schicht entfällt' end,
    coalesce(st_name, s.name) || ' am ' || to_char(s.date, 'DD.MM.YYYY') || ', '
      || to_char(a.start_at at time zone tz, 'HH24:MI') || '–' || to_char(a.end_at at time zone tz, 'HH24:MI'),
    jsonb_build_object('shift_id', s.id, 'date', s.date)
  );
  return null;
end $$;
create trigger assignments_notify after insert or delete on assignments
  for each row execute function notify_assignment_change();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Lokale Schichtzeit -> UTC. Nachtschicht (Ende <= Beginn) endet am Folgetag.
create or replace function shift_bounds(p_date date, p_start time, p_end time, p_tz text,
  out start_at timestamptz, out end_at timestamptz)
language sql immutable as $$
  select (p_date + p_start) at time zone p_tz,
         (case when p_end <= p_start then p_date + 1 else p_date end + p_end) at time zone p_tz
$$;

-- Schicht für Typ + Datum holen oder anlegen (idempotent).
create or replace function ensure_shift(p_shift_type_id uuid, p_date date) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  st shift_types;
  tz text;
  b record;
  v_id uuid;
begin
  select * into st from shift_types where id = p_shift_type_id;
  if st.id is null or not can_plan(st.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select timezone into tz from tenants where id = st.tenant_id;
  select * into b from shift_bounds(p_date, st.start_time, st.end_time, tz);
  insert into shifts (tenant_id, shift_type_id, location_id, date, start_at, end_at, min_staff)
    values (st.tenant_id, st.id, st.location_id, p_date, b.start_at, b.end_at, st.min_staff)
    on conflict (shift_type_id, date) where shift_type_id is not null do nothing
    returning id into v_id;
  if v_id is null then
    select id into v_id from shifts where shift_type_id = p_shift_type_id and date = p_date;
  end if;
  return v_id;
end $$;

-- Warnungen vor einer Zuweisung. Blockiert nichts, außer der Doppelbuchung,
-- die der Exclusion-Constraint ohnehin verhindert.
create or replace function check_assignment(p_shift_id uuid, p_member_id uuid,
  p_start_at timestamptz default null, p_end_at timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s shifts;
  t tenants;
  v_start timestamptz;
  v_end timestamptz;
  w jsonb := '[]';
  v_local_date date;
  v_hours numeric;
  m members;
begin
  select * into s from shifts where id = p_shift_id;
  if s.id is null or not can_plan(s.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into t from tenants where id = s.tenant_id;
  select * into m from members where id = p_member_id and tenant_id = s.tenant_id;
  v_start := coalesce(p_start_at, s.start_at);
  v_end := coalesce(p_end_at, s.end_at);
  v_local_date := (v_start at time zone t.timezone)::date;

  if exists (select 1 from assignments a where a.member_id = p_member_id and a.shift_id <> p_shift_id
             and tstzrange(a.start_at, a.end_at) && tstzrange(v_start, v_end)) then
    w := w || jsonb_build_object('code','overlap');
  end if;

  if exists (select 1 from assignments a where a.member_id = p_member_id and a.shift_id <> p_shift_id
             and not tstzrange(a.start_at, a.end_at) && tstzrange(v_start, v_end)
             and (a.end_at > v_start - make_interval(mins => (t.min_rest_hours * 60)::int) and a.end_at <= v_start
                  or a.start_at < v_end + make_interval(mins => (t.min_rest_hours * 60)::int) and a.start_at >= v_end)) then
    w := w || jsonb_build_object('code','rest_time', 'min_hours', t.min_rest_hours);
  end if;

  if exists (select 1 from absences ab where ab.member_id = p_member_id
             and ab.status in ('requested','approved')
             and v_local_date between ab.start_date and ab.end_date) then
    w := w || jsonb_build_object('code','absent');
  end if;

  if s.shift_type_id is not null and exists (
       select 1 from shift_type_qualifications q
       where q.shift_type_id = s.shift_type_id
         and not exists (select 1 from member_qualifications mq
                         where mq.member_id = p_member_id and mq.qualification_id = q.qualification_id
                           and (mq.valid_until is null or mq.valid_until >= v_local_date))) then
    w := w || jsonb_build_object('code','missing_qualification');
  end if;

  if exists (select 1 from availabilities av where av.member_id = p_member_id and av.kind = 'unavailable'
             and (av.on_date = v_local_date or av.weekday = extract(isodow from v_local_date))) then
    w := w || jsonb_build_object('code','unavailable');
  end if;

  if m.monthly_hours_limit is not null then
    select coalesce(sum(extract(epoch from (a.end_at - a.start_at)) / 3600), 0) into v_hours
      from assignments a
      where a.member_id = p_member_id and a.shift_id <> p_shift_id
        and date_trunc('month', a.start_at at time zone t.timezone) = date_trunc('month', v_start at time zone t.timezone);
    v_hours := v_hours + extract(epoch from (v_end - v_start)) / 3600;
    if v_hours > m.monthly_hours_limit then
      w := w || jsonb_build_object('code','monthly_hours_exceeded', 'hours', round(v_hours, 2),
                                   'limit', m.monthly_hours_limit);
    end if;
  end if;

  return w;
end $$;

-- Mandant anlegen: erster Nutzer wird Chef.
create or replace function create_tenant(p_slug text, p_name text, p_display_name text, p_initials text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_member uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  insert into tenants (slug, name) values (lower(p_slug), p_name) returning id into v_tenant;
  insert into members (tenant_id, user_id, display_name, initials, role, status)
    values (v_tenant, auth.uid(), p_display_name, upper(p_initials), 'chef', 'active')
    returning id into v_member;
  insert into member_contacts (member_id, tenant_id, email)
    select v_member, v_tenant, email from auth.users where id = auth.uid();
  return v_tenant;
end $$;

-- Krankmeldung mit einem Tipp: sofort genehmigt, Planer werden benachrichtigt.
create or replace function report_sick(p_tenant uuid, p_start date, p_end date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := my_member_id(p_tenant);
  v_id uuid;
begin
  if v_member is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into absences (tenant_id, member_id, kind, start_date, end_date, status)
    values (p_tenant, v_member, 'sick', p_start, coalesce(p_end, p_start), 'approved')
    returning id into v_id;
  insert into notifications (tenant_id, member_id, type, title, data)
    select p_tenant, m.id, 'absence_sick', 'Krankmeldung', jsonb_build_object('absence_id', v_id)
    from members m where m.tenant_id = p_tenant and m.status = 'active' and m.role in ('chef','planer');
  return v_id;
end $$;

-- Urlaub beantragen; Urlaubssperre wird hart geprüft.
create or replace function request_vacation(p_tenant uuid, p_start date, p_end date, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := my_member_id(p_tenant);
  v_id uuid;
begin
  if v_member is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from vacation_blocks b where b.tenant_id = p_tenant
             and daterange(b.start_date, b.end_date, '[]') && daterange(p_start, p_end, '[]')) then
    raise exception 'vacation_blocked' using errcode = 'P0001';
  end if;
  insert into absences (tenant_id, member_id, kind, start_date, end_date, comment)
    values (p_tenant, v_member, 'vacation', p_start, p_end, p_comment)
    returning id into v_id;
  insert into notifications (tenant_id, member_id, type, title, data)
    select p_tenant, m.id, 'absence_requested', 'Neuer Urlaubsantrag', jsonb_build_object('absence_id', v_id)
    from members m where m.tenant_id = p_tenant and m.status = 'active' and m.role in ('chef','planer');
  return v_id;
end $$;

create or replace function decide_absence(p_absence_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  a absences;
begin
  select * into a from absences where id = p_absence_id for update;
  if a.id is null or not can_plan(a.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if a.status <> 'requested' then
    raise exception 'already_decided' using errcode = 'P0001';
  end if;
  update absences set status = case when p_approve then 'approved' else 'rejected' end,
                      decided_by = my_member_id(a.tenant_id), decided_at = now()
    where id = a.id;
  insert into notifications (tenant_id, member_id, type, title, data)
    values (a.tenant_id, a.member_id,
            case when p_approve then 'absence_approved' else 'absence_rejected' end,
            case when p_approve then 'Urlaub genehmigt' else 'Urlaub abgelehnt' end,
            jsonb_build_object('absence_id', a.id));
end $$;

-- Schicht zum Tausch anbieten.
create or replace function offer_swap(p_assignment_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a assignments;
  v_id uuid;
begin
  select * into a from assignments where id = p_assignment_id;
  if a.id is null or a.member_id <> my_member_id(a.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into swap_requests (tenant_id, assignment_id, offered_by, expires_at)
    values (a.tenant_id, a.id, a.member_id, a.start_at)
    returning id into v_id;
  return v_id;
end $$;

create or replace function apply_swap(p_swap_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r swap_requests;
  v_member uuid;
begin
  select * into r from swap_requests where id = p_swap_id;
  v_member := my_member_id(r.tenant_id);
  if r.id is null or v_member is null or v_member = r.offered_by then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if r.status <> 'open' then
    raise exception 'swap_not_open' using errcode = 'P0001';
  end if;
  insert into swap_applications (tenant_id, swap_request_id, member_id)
    values (r.tenant_id, r.id, v_member)
    on conflict do nothing;
  insert into notifications (tenant_id, member_id, type, title, data)
    values (r.tenant_id, r.offered_by, 'swap_application', 'Bewerbung auf deinen Tausch',
            jsonb_build_object('swap_id', r.id));
end $$;

-- Tausch annehmen. Der anbietende Mitarbeiter wählt einen Bewerber; bei
-- swap_requires_approval geht es danach an den Planer (p_approve).
-- Die Umbuchung passiert in einer Transaktion mit Zeilensperre, damit zwei
-- gleichzeitige Genehmigungen nicht beide durchgehen.
create or replace function decide_swap(p_swap_id uuid, p_member_id uuid, p_approve boolean default true)
returns text language plpgsql security definer set search_path = public as $$
declare
  r swap_requests;
  t tenants;
  me uuid;
  is_planner boolean;
begin
  select * into r from swap_requests where id = p_swap_id for update;
  if r.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into t from tenants where id = r.tenant_id;
  me := my_member_id(r.tenant_id);
  is_planner := can_plan(r.tenant_id);

  if r.status = 'open' and me = r.offered_by then
    if not exists (select 1 from swap_applications where swap_request_id = r.id and member_id = p_member_id) then
      raise exception 'not_an_applicant' using errcode = 'P0001';
    end if;
    update swap_requests set chosen_member_id = p_member_id where id = r.id;
    if t.swap_requires_approval then
      update swap_requests set status = 'pending_approval' where id = r.id;
      insert into notifications (tenant_id, member_id, type, title, data)
        select r.tenant_id, m.id, 'swap_pending', 'Schichttausch wartet auf Freigabe', jsonb_build_object('swap_id', r.id)
        from members m where m.tenant_id = r.tenant_id and m.status = 'active' and m.role in ('chef','planer');
      return 'pending_approval';
    end if;
    r.chosen_member_id := p_member_id;
  elsif r.status = 'pending_approval' and is_planner then
    if not p_approve then
      update swap_requests set status = 'rejected', decided_by = me, decided_at = now() where id = r.id;
      insert into notifications (tenant_id, member_id, type, title, data)
        values (r.tenant_id, r.offered_by, 'swap_rejected', 'Schichttausch abgelehnt', jsonb_build_object('swap_id', r.id)),
               (r.tenant_id, r.chosen_member_id, 'swap_rejected', 'Schichttausch abgelehnt', jsonb_build_object('swap_id', r.id));
      return 'rejected';
    end if;
  elsif r.status not in ('open','pending_approval') then
    raise exception 'already_decided' using errcode = 'P0001';
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Umbuchen. Doppelbuchung schlägt am Exclusion-Constraint fehl.
  update assignments set member_id = r.chosen_member_id where id = r.assignment_id;
  update swap_requests set status = 'approved', decided_by = me, decided_at = now() where id = r.id;
  insert into notifications (tenant_id, member_id, type, title, data)
    values (r.tenant_id, r.offered_by, 'swap_approved', 'Schichttausch bestätigt', jsonb_build_object('swap_id', r.id)),
           (r.tenant_id, r.chosen_member_id, 'swap_approved', 'Schichttausch bestätigt', jsonb_build_object('swap_id', r.id));
  return 'approved';
end $$;

-- Aufgabe abhaken. Idempotent über die Geräte-UUID und unique(task_id, shift_id).
create or replace function complete_task(p_id uuid, p_task_id uuid, p_shift_id uuid, p_completed_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  s shifts;
  me uuid;
begin
  select * into s from shifts where id = p_shift_id;
  me := my_member_id(s.tenant_id);
  if s.id is null or me is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from assignments where shift_id = s.id and member_id = me)
     and not has_role(s.tenant_id, array['chef','planer','aufgaben_manager']) then
    raise exception 'not_on_shift' using errcode = '42501';
  end if;
  insert into task_completions (id, tenant_id, task_id, shift_id, member_id, completed_at)
    values (p_id, s.tenant_id, p_task_id, s.id, me, p_completed_at)
    on conflict do nothing;
end $$;

-- Monatsstatistik (S11). Stunden aus den tatsächlichen Zuweisungszeiten.
create or replace function stats_month(p_tenant uuid, p_month date)
returns table (member_id uuid, display_name text, initials text, employment_type text,
               shifts bigint, hours numeric, sick_days bigint, vacation_days bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  tz text;
begin
  if not has_role(p_tenant, array['chef','planer']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select timezone into tz from tenants where id = p_tenant;
  return query
  select m.id, m.display_name, m.initials, m.employment_type,
         count(a.id),
         round(coalesce(sum(extract(epoch from (a.end_at - a.start_at)) / 3600), 0)::numeric, 2),
         (select count(*) from absences ab, generate_series(ab.start_date, ab.end_date, interval '1 day') d
           where ab.member_id = m.id and ab.kind = 'sick' and ab.status = 'approved'
             and date_trunc('month', d) = date_trunc('month', p_month::timestamp)),
         (select count(*) from absences ab, generate_series(ab.start_date, ab.end_date, interval '1 day') d
           join tenants tt on tt.id = p_tenant
           where ab.member_id = m.id and ab.kind = 'vacation' and ab.status = 'approved'
             and date_trunc('month', d) = date_trunc('month', p_month::timestamp)
             and extract(isodow from d)::smallint = any (tt.workdays))
  from members m
  left join assignments a on a.member_id = m.id
    and date_trunc('month', a.start_at at time zone tz) = date_trunc('month', p_month::timestamp)
  where m.tenant_id = p_tenant and m.status <> 'archived'
  group by m.id
  order by m.employment_type, m.display_name;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table tenants enable row level security;
alter table members enable row level security;
alter table member_contacts enable row level security;
alter table invitations enable row level security;
alter table locations enable row level security;
alter table qualifications enable row level security;
alter table member_qualifications enable row level security;
alter table availabilities enable row level security;
alter table shift_types enable row level security;
alter table shift_type_qualifications enable row level security;
alter table shifts enable row level security;
alter table assignments enable row level security;
alter table shift_templates enable row level security;
alter table shift_template_entries enable row level security;
alter table handover_notes enable row level security;
alter table absences enable row level security;
alter table vacation_blocks enable row level security;
alter table swap_requests enable row level security;
alter table swap_applications enable row level security;
alter table tasks enable row level security;
alter table task_shift_types enable row level security;
alter table task_completions enable row level security;
alter table quick_action_folders enable row level security;
alter table quick_actions enable row level security;
alter table quick_action_entries enable row level security;
alter table quick_action_reminders_sent enable row level security;
alter table notifications enable row level security;
alter table notification_preferences enable row level security;
alter table tenant_notification_defaults enable row level security;
alter table device_tokens enable row level security;
alter table stripe_events enable row level security;
-- quick_action_reminders_sent, stripe_events: keine Policies = nur service_role.

-- tenants
create policy tenants_select on tenants for select using (is_member(id));
create policy tenants_update on tenants for update
  using (has_role(id, array['chef'])) with check (has_role(id, array['chef']));
-- Anlegen nur über create_tenant(); Plan/Status/Stripe-Felder schreibt nur der
-- Stripe-Webhook mit service_role. Spalten-Grants unten verhindern, dass ein
-- Chef sich selbst den Plan umstellt.

-- members: alle Mitglieder sehen Name, Kürzel, Farbe, Typ (Plan braucht das).
create policy members_select on members for select using (is_member(tenant_id));
create policy members_write on members for all
  using (has_role(tenant_id, array['chef'])) with check (has_role(tenant_id, array['chef']));

create policy member_contacts_select on member_contacts for select
  using (can_plan(tenant_id) or member_id = my_member_id(tenant_id));
create policy member_contacts_write on member_contacts for all
  using (has_role(tenant_id, array['chef']) or member_id = my_member_id(tenant_id))
  with check (has_role(tenant_id, array['chef']) or member_id = my_member_id(tenant_id));

create policy invitations_chef on invitations for all
  using (has_role(tenant_id, array['chef'])) with check (has_role(tenant_id, array['chef']));

-- Stammdaten: lesen alle Mitglieder, schreiben Chef + Planer.
create policy locations_select on locations for select using (is_member(tenant_id));
create policy locations_write on locations for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
create policy qualifications_select on qualifications for select using (is_member(tenant_id));
create policy qualifications_write on qualifications for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
create policy mq_select on member_qualifications for select using (is_member(tenant_id));
create policy mq_write on member_qualifications for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
create policy shift_types_select on shift_types for select using (is_member(tenant_id));
create policy shift_types_write on shift_types for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
create policy stq_select on shift_type_qualifications for select using (is_member(tenant_id));
create policy stq_write on shift_type_qualifications for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
create policy templates_select on shift_templates for select using (is_member(tenant_id));
create policy templates_write on shift_templates for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
create policy template_entries_select on shift_template_entries for select using (is_member(tenant_id));
create policy template_entries_write on shift_template_entries for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));

create policy availabilities_select on availabilities for select
  using (can_plan(tenant_id) or member_id = my_member_id(tenant_id));
create policy availabilities_write on availabilities for all
  using (can_plan(tenant_id) or member_id = my_member_id(tenant_id))
  with check (can_plan(tenant_id) or member_id = my_member_id(tenant_id));

-- Plan: Mitarbeiter sehen den Gesamtplan nur, wenn der Mandant es erlaubt.
create policy shifts_select on shifts for select using (is_member(tenant_id));
create policy shifts_write on shifts for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));

create policy assignments_select on assignments for select using (
  has_role(tenant_id, array['chef','planer','aufgaben_manager'])
  or member_id = my_member_id(tenant_id)
  or (is_member(tenant_id) and (select employees_see_full_plan from tenants where id = tenant_id))
);
create policy assignments_write on assignments for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));

create policy handover_select on handover_notes for select using (is_member(tenant_id));
create policy handover_insert on handover_notes for insert
  with check (is_member(tenant_id) and author_id = my_member_id(tenant_id));

-- Abwesenheiten: Grund (krank/Urlaub) sehen nur Planer und der Betroffene.
-- Schreiben über report_sick / request_vacation / decide_absence.
create policy absences_select on absences for select
  using (can_plan(tenant_id) or member_id = my_member_id(tenant_id));
create policy absences_write on absences for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
create policy absences_cancel_own on absences for update
  using (member_id = my_member_id(tenant_id) and status = 'requested')
  with check (member_id = my_member_id(tenant_id) and status = 'cancelled');

create policy blocks_select on vacation_blocks for select using (is_member(tenant_id));
create policy blocks_write on vacation_blocks for all
  using (has_role(tenant_id, array['chef'])) with check (has_role(tenant_id, array['chef']));

-- Tauschbörse: alle Mitglieder sehen offene Angebote. Schreiben nur per RPC.
create policy swaps_select on swap_requests for select using (is_member(tenant_id));
create policy swap_apps_select on swap_applications for select using (is_member(tenant_id));

-- Aufgaben
create policy tasks_select on tasks for select using (is_member(tenant_id));
create policy tasks_write on tasks for all
  using (has_role(tenant_id, array['chef','planer','aufgaben_manager']))
  with check (has_role(tenant_id, array['chef','planer','aufgaben_manager']));
create policy task_st_select on task_shift_types for select using (is_member(tenant_id));
create policy task_st_write on task_shift_types for all
  using (has_role(tenant_id, array['chef','planer','aufgaben_manager']))
  with check (has_role(tenant_id, array['chef','planer','aufgaben_manager']));
create policy completions_select on task_completions for select using (is_member(tenant_id));
create policy completions_delete_own on task_completions for delete
  using (member_id = my_member_id(tenant_id));

-- Schnellaktionen
create policy qa_folders_select on quick_action_folders for select using (is_member(tenant_id));
create policy qa_folders_write on quick_action_folders for all
  using (has_role(tenant_id, array['chef','aufgaben_manager']))
  with check (has_role(tenant_id, array['chef','aufgaben_manager']));
create policy qa_select on quick_actions for select using (is_member(tenant_id));
create policy qa_write on quick_actions for all
  using (has_role(tenant_id, array['chef','aufgaben_manager']))
  with check (has_role(tenant_id, array['chef','aufgaben_manager']));
create policy qa_entries_select on quick_action_entries for select using (is_member(tenant_id));
create policy qa_entries_insert on quick_action_entries for insert
  with check (is_member(tenant_id) and member_id = my_member_id(tenant_id));

-- Benachrichtigungen: nur eigene; anlegen nur Server (RPCs, Edge Functions).
create policy notifications_select on notifications for select
  using (member_id = my_member_id(tenant_id));
create policy notifications_mark_read on notifications for update
  using (member_id = my_member_id(tenant_id)) with check (member_id = my_member_id(tenant_id));
create policy prefs_own on notification_preferences for all
  using (member_id = my_member_id(tenant_id)) with check (member_id = my_member_id(tenant_id));
create policy tenant_defaults_select on tenant_notification_defaults for select using (is_member(tenant_id));
create policy tenant_defaults_write on tenant_notification_defaults for all
  using (has_role(tenant_id, array['chef'])) with check (has_role(tenant_id, array['chef']));
create policy device_tokens_own on device_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Spaltenrechte: Plan- und Abrechnungsfelder sind für Clients schreibgeschützt.
-- ---------------------------------------------------------------------------

revoke update on tenants from authenticated;
grant update (name, timezone, swap_requires_approval, employees_see_full_plan,
              min_rest_hours, workdays, brand_color, logo_path, updated_at)
  on tenants to authenticated;

revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;

revoke update on absences from authenticated;
grant update (status, start_date, end_date, comment, updated_at) on absences to authenticated;
