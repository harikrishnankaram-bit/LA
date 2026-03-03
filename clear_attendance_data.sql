-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- This script deletes all existing attendance records to start fresh.
-- WARNING: This action cannot be undone.

DELETE FROM public.attendance_daily;

-- (Optional) If you also want to restart the primary key sequence or ensure clean state,
-- although UUIDs wouldn't need a sequence reset.
