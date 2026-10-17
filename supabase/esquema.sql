-- DIACLASHOM · esquema de la base de datos en Supabase
-- Pegar entero en el editor SQL del proyecto y ejecutar una sola vez.
--
-- La base de datos solo guarda bloques cifrados en el dispositivo.
-- No hay columnas con notas, claves de alumno ni textos legibles.

-- 1. Perfil: la sal y el verificador de la clave de cifrado (no son secretos).
create table if not exists public.perfil (
  owner        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  sal          text not null,
  iteraciones  integer not null,
  verificador  text not null,
  creado       timestamptz not null default now()
);

-- 2. Registros: cada dato de la app es un bloque cifrado.
create sequence if not exists public.registros_seq;

create table if not exists public.registros (
  id           uuid primary key,
  owner        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  datos        text not null,
  borrado      boolean not null default false,
  seq          bigint not null default nextval('public.registros_seq'),
  actualizado  timestamptz not null default now()
);

create index if not exists registros_owner_seq on public.registros (owner, seq);

-- Cada cambio recibe un número de orden nuevo: así cada aparato sabe qué le falta.
create or replace function public.registros_marcar()
returns trigger
language plpgsql
as $$
begin
  new.seq := nextval('public.registros_seq');
  new.actualizado := now();
  new.owner := auth.uid();
  return new;
end;
$$;

drop trigger if exists registros_marcar on public.registros;
create trigger registros_marcar
  before insert or update on public.registros
  for each row execute function public.registros_marcar();

-- 3. Seguridad por filas: cada usuario solo ve y toca lo suyo.
alter table public.perfil    enable row level security;
alter table public.registros enable row level security;

drop policy if exists perfil_propio on public.perfil;
create policy perfil_propio on public.perfil
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists registros_propios on public.registros;
create policy registros_propios on public.registros
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- Nadie sin sesión puede leer nada.
revoke all on public.perfil    from anon;
revoke all on public.registros from anon;
grant select, insert, update, delete on public.perfil    to authenticated;
grant select, insert, update, delete on public.registros to authenticated;
grant usage on sequence public.registros_seq to authenticated;
