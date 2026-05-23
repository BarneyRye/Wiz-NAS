create table if not exists "drives" (
    id integer primary key autoincrement,
    name text not null,
    path text not null unique,
    total_bytes integer,
    used_bytes integer
)

create table if not exists "files" (
    id integer primary key autoincrement,
    drive_id integer not null references drives(id) on delete cascade,
    name text not null,
    path text not null,
    size_bytes integer not null default 0,
    mime_type text,
    created_at text not null default (datetime('now')),
    modified_at text not null default (datetime('now')),
    unique(drive_id, path)
)

create table if not exists "users" (
    id integer primary key autoincrement,
    username text not null unique,
    password_hash text not null,
    role text not null default 'viewer' check(role in ('admin', 'user', 'viewer')),
    blocked integer not null default 0
)

create table if not exists "revoked_tokens" (
    jti text primary key,
    expires_at integer not null
)