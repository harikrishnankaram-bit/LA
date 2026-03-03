-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- This script updates the mark_login and mark_logout functions to automatically 
-- close out open attendance sessions from previous days at 23:59:59.

-- 1. Update mark_login function
CREATE OR REPLACE FUNCTION public.mark_login(mode_input TEXT)
RETURNS JSON AS $$
DECLARE
  today        DATE        := CURRENT_DATE;
  now_time     TIMESTAMPTZ := NOW();
  is_holiday   BOOLEAN;
  user_company TEXT;
  calc_status  TEXT        := 'PRESENT';
BEGIN
  -- Auto-logout previous unclosed sessions at 23:59:59 of their respective dates
  UPDATE attendance_daily
  SET logout_time = (date + INTERVAL '1 day' - INTERVAL '1 second')
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


-- 2. Update mark_logout function
CREATE OR REPLACE FUNCTION public.mark_logout()
RETURNS JSON AS $$
DECLARE
  open_record_id UUID;
  open_date DATE;
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
  IF open_date < CURRENT_DATE THEN
    UPDATE attendance_daily
    SET logout_time = (open_date + INTERVAL '1 day' - INTERVAL '1 second')
    WHERE id = open_record_id;
    
    RETURN json_build_object('status', 'success', 'message', 'Previous session auto-closed at midnight.');
  ELSE
    -- Normal logout
    UPDATE attendance_daily
    SET logout_time = NOW()
    WHERE id = open_record_id;

    RETURN json_build_object('status', 'success', 'message', 'Logged out successfully');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
