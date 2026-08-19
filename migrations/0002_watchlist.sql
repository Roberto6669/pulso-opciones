create table if not exists watchlist (
  id         serial primary key,
  user_id    text not null,
  symbol     text not null,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);
create index if not exists watchlist_user_id_idx on watchlist (user_id);
