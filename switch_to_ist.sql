-- Run this in: Supabase Dashboard -> SQL Editor
-- This script changes the attendance timestamp columns to store actual local time (Asia/Kolkata)
-- and updates the login/logout functions to correctly record the time exactly as it is in IST.

-- 1. Change the data types from TIMESTAMPTZ to TIMESTAMP (without time zone) 
-- and automatically translate any existing UTC data to IST (+05:30)
ALTER TABLE public.attendance_daily
ALTER COLUMN login_time TYPE TIMESTAMP WITHOUT TIME ZONE
USING login_time AT TIME ZONE 'Asia/Kolkata';

ALTER TABLE public.attendance_daily
ALTER COLUMN logout_time TYPE TIMESTAMP WITHOUT TIME ZONE
USING logout_time AT TIME ZONE 'Asia/Kolkata';

-- 2. Update mark_login function to use IST 
CREATE OR REPLACE FUNCTION public.mark_login(mode_input TEXT)
RETURNS JSON AS $$
DECLARE
  -- Calculate today's date in IST instead of UTC
  today        DATE        := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
  -- Store current time physically as it appears in IST
  now_time     TIMESTAMP   := NOW() AT TIME ZONE 'Asia/Kolkata';
  is_holiday   BOOLEAN;
  user_company TEXT;
  calc_status  TEXT        := 'PRESENT';
BEGIN
  -- Auto-logout previous unclosed sessions at 23:59:59 of their respective dates
  UPDATE attendance_daily
  SET logout_time = (date + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMP
  WHERE user_id = auth.uid()
    AND logout_time IS NULL
    AND date < today;

  -- Block if already punched in today
  IF EXISTS (
    SELECT 1 FROM attendance_daily
    WHERE user_id = auth.uid() AND date = today
  ) THEN
    RAISE EXCEPTION 'Attendance already marked for today';
  END IF;

  -- Get user's company
  SELECT company INTO user_company
  FROM profiles
  WHERE profiles.user_id = auth.uid();

  -- Check if today is a company holiday
  SELECT EXISTS (
    SELECT 1 FROM company_holidays
    WHERE date = today AND (company IS NULL OR company = user_company)
  ) INTO is_holiday;

  -- Insert the punch-in record
  INSERT INTO attendance_daily (user_id, date, mode, login_time, status, late_minutes)
  VALUES (auth.uid(), today, mode_input, now_time, calc_status, 0);

  RETURN json_build_object(
    'status', 'success',
    'message', 'Logged in successfully',
    'attendance_status', calc_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Update mark_logout function to use IST
CREATE OR REPLACE FUNCTION public.mark_logout()
RETURNS JSON AS $$
DECLARE
  open_record_id UUID;
  open_date DATE;
  -- Calculate today's date in IST instead of UTC
  today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
  -- Store current time physically as it appears in IST
  now_time TIMESTAMP := NOW() AT TIME ZONE 'Asia/Kolkata';
BEGIN
  -- Find the most recent un-logged-out attendance for the user
  SELECT id, date INTO open_record_id, open_date
  FROM attendance_daily
  WHERE user_id = auth.uid()
    AND logout_time IS NULL
  ORDER BY date DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active login found or already logged out';
  END IF;

  -- If the active login was on a previous day, auto-logout at 23:59:59 of that day
  IF open_date < today THEN
    UPDATE attendance_daily
    SET logout_time = (open_date + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMP
    WHERE id = open_record_id;
    
    RETURN json_build_object('status', 'success', 'message', 'Previous session auto-closed at midnight.');
  ELSE
    -- Normal logout using physical IST time
    UPDATE attendance_daily
    SET logout_time = now_time
    WHERE id = open_record_id;

    RETURN json_build_object('status', 'success', 'message', 'Logged out successfully');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
