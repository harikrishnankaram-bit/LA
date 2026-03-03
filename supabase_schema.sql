-- 1. Create the new daily attendance table
CREATE TABLE IF NOT EXISTS attendance_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    mode TEXT CHECK (mode IN ('WFO', 'WFH')),
    login_time TIMESTAMPTZ,
    logout_time TIMESTAMPTZ,
    status TEXT CHECK (status IN ('PRESENT', 'LATE', 'ABSENT')),
    late_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 2. Create the RPC function for Login
CREATE OR REPLACE FUNCTION mark_login(mode_input TEXT)
RETURNS JSON AS $$
DECLARE
    today DATE := CURRENT_DATE;
    now_time TIMESTAMPTZ := NOW();
    shift_start TIMESTAMPTZ := (today || ' 10:00:00')::TIMESTAMPTZ;
    grace_time TIMESTAMPTZ := (today || ' 10:15:00')::TIMESTAMPTZ;
    calc_status TEXT;
    calc_late_minutes INTEGER := 0;
BEGIN
    -- Auto-logout previous unclosed sessions at 23:59:59 of their respective dates
    UPDATE attendance_daily
    SET logout_time = (date + INTERVAL '1 day' - INTERVAL '1 second')
    WHERE user_id = auth.uid()
      AND logout_time IS NULL
      AND date < today;

    -- Check if already logged in
    IF EXISTS (SELECT 1 FROM attendance_daily WHERE user_id = auth.uid() AND date = today) THEN
        RAISE EXCEPTION 'Attendance already marked for today';
    END IF;

    -- Calculate Status
    IF now_time <= grace_time THEN
        calc_status := 'PRESENT';
    ELSE
        calc_status := 'LATE';
        calc_late_minutes := EXTRACT(EPOCH FROM (now_time - shift_start)) / 60;
    END IF;

    -- Insert Record
    INSERT INTO attendance_daily (user_id, date, mode, login_time, status, late_minutes)
    VALUES (auth.uid(), today, mode_input, now_time, calc_status, calc_late_minutes);

    RETURN json_build_object('status', 'success', 'message', 'Logged in successfully', 'attendance_status', calc_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the RPC function for Logout
CREATE OR REPLACE FUNCTION mark_logout()
RETURNS JSON AS $$
DECLARE
    open_record_id UUID;
    open_date DATE;
BEGIN
    SELECT id, date INTO open_record_id, open_date
    FROM attendance_daily
    WHERE user_id = auth.uid()
      AND logout_time IS NULL
    ORDER BY date DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active login found or already logged out';
    END IF;

    IF open_date < CURRENT_DATE THEN
        UPDATE attendance_daily
        SET logout_time = (open_date + INTERVAL '1 day' - INTERVAL '1 second')
        WHERE id = open_record_id;
        
        RETURN json_build_object('status', 'success', 'message', 'Previous session auto-closed at midnight.');
    ELSE
        UPDATE attendance_daily
        SET logout_time = NOW()
        WHERE id = open_record_id;

        RETURN json_build_object('status', 'success', 'message', 'Logged out successfully');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable RLS
ALTER TABLE attendance_daily ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- Employees can view only their own records
CREATE POLICY "Employees view own records" ON attendance_daily
    FOR SELECT USING (auth.uid() = user_id);

-- Employees cannot insert directly (must use RPC) - wait, RPC is redundant if we block insert? 
-- Actually, if we use SECURITY DEFINER in RPC, the user doesn't need INSERT permission on the table technically, 
-- but often it's good practice. However, here we explicitly want to FORCE usage of RPC.
-- So we DO NOT grant INSERT permission to authenticated role, or we make a policy that evaluates to false (or just don't create an INSERT policy).
-- We will NOT create an INSERT or UPDATE policy for public/authenticated role.

-- Admin can view all
CREATE POLICY "Admins view all" ON attendance_daily
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );
