create table if not exists public.session_states (
  id text primary key,
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id text not null,
  kind text not null,
  title text not null,
  message text not null,
  route text,
  action_label text,
  movie_id text,
  session_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_session_id_created_at_idx
  on public.notifications (session_id, created_at desc);

create table if not exists public.tickets (
  id bigint generated always as identity primary key,
  user_id text not null,
  session_id text not null,
  movie_id text not null,
  movie_title text not null,
  cinema text not null,
  showtime text not null,
  session_date date not null,
  seat text not null,
  price numeric(10, 2) not null,
  status text not null default 'confirmed',
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_user_id_created_at_idx
  on public.tickets (user_id, created_at desc);

create index if not exists tickets_session_id_status_idx
  on public.tickets (session_id, status);

create unique index if not exists tickets_active_user_session_idx
  on public.tickets (user_id, session_id)
  where status = 'confirmed';

create unique index if not exists tickets_active_session_seat_idx
  on public.tickets (session_id, session_date, showtime, seat)
  where status = 'confirmed';
