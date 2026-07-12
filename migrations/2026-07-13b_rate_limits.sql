-- Migration: Rate Limits (audit red-team Juli 2026 — "tidak ada rate-limiting
-- sama sekali di api/", endpoint anonim generate-preview/check-email/
-- generate-wizard-questions bisa dipanggil tanpa batas: risiko biaya
-- Anthropic API membengkak + check-email bisa dipakai enumerasi email).
-- Domain: infrastruktur lintas fitur (bukan milik satu domain bisnis)
-- Date: 2026-07-13
--
-- ADDITIVE ONLY. Tabel baru + satu function. Sengaja BUKAN tabel per-domain
-- (beda dengan tier_usage_quota yang melekat ke subscriptions) karena
-- pembatasan di sini per-IP, bukan per-user/per-langganan — pengunjung yang
-- membatasi ini belum tentu (bahkan biasanya belum) py akun sama sekali.
--
-- bucket_key   : "<nama-endpoint>:<ip>:<window-index>" — window-index dibuat
--                di kode (services/rateLimit/checkRateLimit.ts), BUKAN
--                dihitung ulang di sini, supaya satu definisi "window" saja.
-- count        : jumlah hit pada window ini.
-- window_ends_at : kapan window ini berakhir (dipakai function di bawah
--                untuk tahu kapan harus reset count alih-alih menambah).
--
-- Function rate_limit_hit(bucket_key, window_seconds) melakukan
-- INSERT ... ON CONFLICT DO UPDATE dalam SATU statement (atomic — race dua
-- request nyaris bersamaan tetap dapat hitungan yang benar, sama prinsipnya
-- dengan unique index race guard di 2026-07-11b_final_reports_race_guard.sql)
-- dan mengembalikan count SETELAH increment. Caller di services/rateLimit/
-- checkRateLimit.ts yang memutuskan allowed = count <= limit.
--
-- Tidak ada cron pembersihan terpisah (sudah di batas 12 Vercel Serverless
-- Function di plan Hobby, lihat vercel.json) — function ini sendiri yang
-- sesekali (peluang 1%) menghapus baris yang sudah lama kedaluwarsa, supaya
-- tabel tetap kecil tanpa job terjadwal tambahan.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback:
--   drop function if exists rate_limit_hit(text, integer);
--   drop table if exists rate_limits;

create table if not exists rate_limits (
  bucket_key text primary key,
  count integer not null default 1,
  window_ends_at timestamptz not null
);

create index if not exists idx_rate_limits_window_ends_at on rate_limits (window_ends_at);

create or replace function rate_limit_hit(p_bucket_key text, p_window_seconds integer)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into rate_limits (bucket_key, count, window_ends_at)
  values (p_bucket_key, 1, now() + (p_window_seconds || ' seconds')::interval)
  on conflict (bucket_key) do update
    set count = case
          when rate_limits.window_ends_at < now() then 1
          else rate_limits.count + 1
        end,
        window_ends_at = case
          when rate_limits.window_ends_at < now() then now() + (p_window_seconds || ' seconds')::interval
          else rate_limits.window_ends_at
        end
  returning count into v_count;

  if random() < 0.01 then
    delete from rate_limits where window_ends_at < now() - interval '1 hour';
  end if;

  return v_count;
end;
$$;
