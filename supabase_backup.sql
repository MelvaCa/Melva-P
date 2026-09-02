-- =============================================================================
-- Life OS · Supabase 备份脚本 (PostgreSQL / Supabase)
-- 数据来源：浏览器 localStorage 键 "life_os_melva_db_v5"（即整份 state 对象）
-- 备份方式：快照式 JSONB —— 每次备份留一条历史记录，可按日期/ID 回滚，无损。
-- 用法：在 Supabase 项目 → SQL Editor 中粘贴本文件并运行，即可完成建表。
-- =============================================================================

-- 1) 建表 ---------------------------------------------------------------------
create table if not exists public.lifeos_backups (
  id              bigint      generated always as identity primary key,
  snapshot_date  date        not null default current_date,
  schema_version int         not null default 5,        -- 与 app 的 db key 版本一致（v5）
  payload        jsonb       not null,                  -- 完整 state（tasks/diaries/habits/health/lifePlan/...）
  note           text,                                  -- 可选备注，如 "周自动备份" / "手动"
  created_at     timestamptz not null default now()
);

-- 2) 索引 ---------------------------------------------------------------------
create index if not exists idx_lifeos_backups_date
  on public.lifeos_backups (snapshot_date desc, id desc);

-- （可选）若需经常用 SQL 直接过滤 payload 内字段，可启用 GIN 索引
-- create index if not exists idx_lifeos_backups_payload
--   on public.lifeos_backups using gin (payload jsonb_path_ops);

-- 3) 注释 ---------------------------------------------------------------------
comment on table  public.lifeos_backups is 'Life OS 整库 JSONB 快照备份';
comment on column public.lifeos_backups.payload
  is '完整 state 对象，来自浏览器 localStorage 键 "life_os_melva_db_v5"';

-- 4) 常用查询 / 维护 ----------------------------------------------------------

-- 4.1 列出所有备份（最新在前）
select id, snapshot_date, schema_version, note, created_at,
       (payload->'diaries')  is not null as has_diaries,
       (payload->'habits')   is not null as has_habits
from public.lifeos_backups
order by snapshot_date desc, id desc;

-- 4.2 取最新一次备份的 payload（用于恢复）
select payload
from public.lifeos_backups
order by created_at desc
limit 1;

-- 4.3 删除 30 天前的历史快照（始终保留最新一条，按需执行）
-- delete from public.lifeos_backups
-- where created_at < now() - interval '30 days'
--   and id not in (select id from public.lifeos_backups order by created_at desc limit 1);

-- 5) 安全说明（行级安全 RLS）--------------------------------------------------
-- 本应用是单人 PWA、无登录体系，推荐的保护方式：
--   A. 仅通过 Supabase SQL Editor（你的项目角色）或 service_role 写入/读取，
--      前端不暴露任何可写密钥；新建表默认开启 RLS 且无 policy，外部 anon 访问会被拒绝，数据天然受保护。
--   B. 若日后接入 Supabase Auth，改用下方「Auth 版」表，并按用户隔离。
--
-- ⚠️ 若你想让前端（anon key）直接读写，请务必先建 policy，否则默认 RLS 会拒绝访问。

-- ---- Auth 版（可选，启用 Supabase Auth 后再执行）----------------------------
-- create table if not exists public.lifeos_backups_auth (
--   id              uuid        primary key default gen_random_uuid(),
--   user_id        uuid        not null references auth.users(id) on delete cascade,
--   snapshot_date  date        not null default current_date,
--   schema_version int         not null default 5,
--   payload        jsonb       not null,
--   note           text,
--   created_at     timestamptz not null default now()
-- );
-- alter table public.lifeos_backups_auth enable row level security;
-- create policy "own backup read"   on public.lifeos_backups_auth for select using (auth.uid() = user_id);
-- create policy "own backup insert" on public.lifeos_backups_auth for insert with check (auth.uid() = user_id);
-- create policy "own backup delete" on public.lifeos_backups_auth for delete using (auth.uid() = user_id);

-- =============================================================================
-- 如何把当前浏览器里的数据备份进去（无需任何密钥，两步搞定）：
--   1. 打开 Life OS 页面 → 按 F12 → Console，运行随附的 lifeos_export.js，
--      它会自动：① 复制一条 INSERT 语句到剪贴板；② 下载 lifeos_state_YYYY-MM-DD.json。
--   2. 回到 Supabase → SQL Editor，粘贴执行复制的 INSERT 即可完成备份。
--
-- 想自动化/定时备份：用 lifeos_upload.mjs（Node + service_role 密钥，本地运行），
-- 读取 lifeos_export.js 下载的 JSON 文件直接上传，无需手动粘贴 SQL。
--
-- 恢复数据：在 Supabase 运行 4.2 查询得到 payload，回到 Life OS 页面 Console 执行：
--   localStorage.setItem('life_os_melva_db_v5', '<粘贴 payload 文本>'); location.reload();
-- =============================================================================
