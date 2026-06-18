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
