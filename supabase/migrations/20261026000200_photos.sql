-- 사진: 자녀 프로필 사진과 기록(메모) 사진 (D-027, SESSION 09)
-- 사진 파일은 비공개 Storage 버킷 `photos`에 `<부모 id>/<이름>.jpg`로 저장하고, DB에는 경로만 둔다.
-- 보여줄 때는 서버가 짧게 유효한 서명 URL을 만든다(공개 주소 없음). 업로드는 서버 액션이 하고 Storage RLS가 폴더 소유자만 허용한다.
-- 적용 순서: 20261026000000 → 20261026000100 → 이 파일. 앱 배포는 적용 뒤에 한다.

-- ---------------------------------------------------------------------------
-- 자녀 프로필 사진 경로 (홈 상단·프로필의 원형 사진)
-- ---------------------------------------------------------------------------
alter table public.children add column photo_path text;
alter table public.children add constraint children_photo_path_check
  check (photo_path is null or (char_length(photo_path) <= 200 and split_part(photo_path, '/', 1) = user_id::text));
grant update (photo_path) on public.children to authenticated;

-- ---------------------------------------------------------------------------
-- 기록 사진: 기록 하나에 최대 3장. 기록(또는 부모)이 지워지면 행도 지워진다(파일은 앱이 지운다 — BETA.md 7절).
-- ---------------------------------------------------------------------------
alter table public.entries add constraint entries_id_user_id_key unique (id, user_id);

create table public.entry_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null,
  path text not null unique,
  created_at timestamptz not null default now(),
  -- 같은 부모의 기록에만 붙는다
  constraint entry_photos_entry_owner_fkey foreign key (entry_id, user_id)
    references public.entries (id, user_id) on delete cascade,
  -- 경로는 항상 "<내 id>/<파일명>" 이다
  constraint entry_photos_path_check
    check (char_length(path) <= 200 and split_part(path, '/', 1) = user_id::text and path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_.-]+$')
);

create index entry_photos_entry_id_idx on public.entry_photos (entry_id);

-- 한 기록에 3장까지 (앱도 확인하지만 DB가 최종 방어선)
create function public.limit_entry_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.entry_photos where entry_id = new.entry_id) >= 3 then
    raise exception 'entry_photos_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger entry_photos_limit
  before insert on public.entry_photos
  for each row execute function public.limit_entry_photos();

alter table public.entry_photos enable row level security;
revoke all on public.entry_photos from anon, authenticated;
grant select, delete on public.entry_photos to authenticated;
grant insert (user_id, entry_id, path) on public.entry_photos to authenticated;

create policy entry_photos_select_own on public.entry_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy entry_photos_insert_own on public.entry_photos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy entry_photos_delete_own on public.entry_photos
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: 비공개 버킷. 5MB, 이미지 3종만. 폴더(첫 경로 조각)가 내 id 인 객체만 읽고 쓰고 지울 수 있다.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
