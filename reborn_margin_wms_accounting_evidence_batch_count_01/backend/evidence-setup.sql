begin;
create table public.reborn_evidence_admins (user_id uuid primary key references auth.users(id), created_at timestamptz not null default now());
create table public.reborn_evidence_items (
 id uuid primary key, business_date date not null, partner text not null check(length(partner) between 1 and 100),
 document_type text not null default '기타' check(length(document_type)<=40), review_status text not null default '미검토' check(review_status in ('미검토','확인 필요','검토 완료')),
 note text not null default '' check(length(note)<=500), preview_path text not null unique, thumbnail_path text not null unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 deleted_at timestamptz, ready boolean not null default false
);
create table public.reborn_evidence_files (
 id uuid primary key references public.reborn_evidence_items(id), original_path text not null unique, original_name text not null,
 original_sha256 text not null, bytes integer not null check(bytes between 1 and 10485760), mime text not null,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.reborn_evidence_events (
 id bigint generated always as identity primary key, item_id uuid not null references public.reborn_evidence_items(id),
 actor uuid not null references auth.users(id), action text not null, at timestamptz not null default now(), details jsonb not null default '{}'
);
create index reborn_evidence_date_idx on public.reborn_evidence_items(business_date desc,created_at desc) where deleted_at is null;
create index reborn_evidence_partner_idx on public.reborn_evidence_items(partner,business_date desc);
create index reborn_evidence_event_idx on public.reborn_evidence_events(item_id,at desc);
create index reborn_evidence_creator_idx on public.reborn_evidence_files(created_by);
create index reborn_evidence_actor_idx on public.reborn_evidence_events(actor);
alter table public.reborn_evidence_admins enable row level security;
alter table public.reborn_evidence_items enable row level security;
alter table public.reborn_evidence_files enable row level security;
alter table public.reborn_evidence_events enable row level security;
revoke all on public.reborn_evidence_admins,public.reborn_evidence_items,public.reborn_evidence_files,public.reborn_evidence_events from anon,authenticated;
grant select on public.reborn_evidence_admins,public.reborn_evidence_items,public.reborn_evidence_files,public.reborn_evidence_events to authenticated;
grant select on public.reborn_evidence_items to anon;
grant all on public.reborn_evidence_admins,public.reborn_evidence_items,public.reborn_evidence_files,public.reborn_evidence_events to service_role;
grant usage,select on sequence public.reborn_evidence_events_id_seq to service_role;
create policy reborn_evidence_admin_self on public.reborn_evidence_admins for select to authenticated using(user_id=(select auth.uid()));
create function public.reborn_evidence_can_manage() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.reborn_evidence_admins where user_id=(select auth.uid()));
$$;
revoke all on function public.reborn_evidence_can_manage() from public,anon;
grant execute on function public.reborn_evidence_can_manage() to authenticated,service_role;
create policy reborn_evidence_public_items on public.reborn_evidence_items for select to anon using(ready and deleted_at is null);
create policy reborn_evidence_authenticated_items on public.reborn_evidence_items for select to authenticated using((ready and deleted_at is null) or (select public.reborn_evidence_can_manage()));
create policy reborn_evidence_private_files on public.reborn_evidence_files for select to authenticated using((select public.reborn_evidence_can_manage()));
create policy reborn_evidence_private_events on public.reborn_evidence_events for select to authenticated using((select public.reborn_evidence_can_manage()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('reborn-accounting-evidence','reborn-accounting-evidence',false,10485760,array['image/jpeg','image/png']);
create policy reborn_evidence_preview_read on storage.objects for select to anon,authenticated using (
 bucket_id='reborn-accounting-evidence' and exists(select 1 from public.reborn_evidence_items item where item.ready and item.deleted_at is null and name in (item.preview_path,item.thumbnail_path))
);
create policy reborn_evidence_original_read on storage.objects for select to authenticated using(bucket_id='reborn-accounting-evidence' and (select public.reborn_evidence_can_manage()));
create function public.reborn_evidence_commit(p_item jsonb,p_file jsonb,p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.reborn_evidence_items; existing public.reborn_evidence_files;
begin
 if not exists(select 1 from public.reborn_evidence_admins where user_id=p_actor) then raise exception 'FORBIDDEN'; end if;
 select * into existing from public.reborn_evidence_files where id=(p_item->>'id')::uuid;
 if found then
  select * into saved from public.reborn_evidence_items where id=existing.id;
  if existing.created_by<>p_actor or existing.original_sha256<>p_file->>'original_sha256' or saved.partner<>p_item->>'partner' or saved.business_date<>(p_item->>'business_date')::date or saved.document_type<>p_item->>'document_type' or saved.note<>p_item->>'note' then raise exception 'ID_CONFLICT'; end if;
  return to_jsonb(saved);
 end if;
 insert into public.reborn_evidence_items(id,business_date,partner,document_type,note,preview_path,thumbnail_path,ready)
 values((p_item->>'id')::uuid,(p_item->>'business_date')::date,p_item->>'partner',p_item->>'document_type',p_item->>'note',p_item->>'preview_path',p_item->>'thumbnail_path',true) returning * into saved;
 insert into public.reborn_evidence_files(id,original_path,original_name,original_sha256,bytes,mime,created_by)
 values(saved.id,p_file->>'original_path',p_file->>'original_name',p_file->>'original_sha256',(p_file->>'bytes')::integer,p_file->>'mime',p_actor);
 insert into public.reborn_evidence_events(item_id,actor,action) values(saved.id,p_actor,'등록');
 return to_jsonb(saved);
end; $$;
create function public.reborn_evidence_change(p_id uuid,p_version integer,p_action text,p_values jsonb,p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.reborn_evidence_items; before_values jsonb;
begin
 if not exists(select 1 from public.reborn_evidence_admins where user_id=p_actor) then raise exception 'FORBIDDEN'; end if;
 if p_action not in ('수정','휴지통','복원') then raise exception 'INVALID_ACTION'; end if;
 select jsonb_build_object('business_date',business_date,'partner',partner,'document_type',document_type,'review_status',review_status,'note',note,'deleted_at',deleted_at) into before_values
 from public.reborn_evidence_items where id=p_id and version=p_version for update;
 if not found then raise exception 'VERSION_CONFLICT'; end if;
 update public.reborn_evidence_items set
  business_date=case when p_action='수정' then (p_values->>'business_date')::date else business_date end,
  partner=case when p_action='수정' then p_values->>'partner' else partner end,
  document_type=case when p_action='수정' then p_values->>'document_type' else document_type end,
  review_status=case when p_action='수정' then p_values->>'review_status' else review_status end,
  note=case when p_action='수정' then p_values->>'note' else note end,
  deleted_at=case when p_action='휴지통' then now() when p_action='복원' then null else deleted_at end,
  updated_at=now(),version=version+1 where id=p_id and version=p_version returning * into saved;
 if not found then raise exception 'VERSION_CONFLICT'; end if;
 insert into public.reborn_evidence_events(item_id,actor,action,details) values(p_id,p_actor,p_action,jsonb_build_object('before',before_values,'after',jsonb_build_object('business_date',saved.business_date,'partner',saved.partner,'document_type',saved.document_type,'review_status',saved.review_status,'note',saved.note,'deleted_at',saved.deleted_at)));
 return to_jsonb(saved);
end; $$;
revoke all on function public.reborn_evidence_commit(jsonb,jsonb,uuid),public.reborn_evidence_change(uuid,integer,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.reborn_evidence_commit(jsonb,jsonb,uuid),public.reborn_evidence_change(uuid,integer,text,jsonb,uuid) to service_role;
commit;
