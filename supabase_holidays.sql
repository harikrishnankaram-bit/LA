-- 1. Create Company Holidays Table
CREATE TABLE IF NOT EXISTS company_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    name TEXT NOT NULL,
    company TEXT, -- Null means it applies to all companies
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, company)
);

-- Enable RLS for Holidays
ALTER TABLE company_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for holidays" ON company_holidays
    FOR SELECT USING (true);

-- Admin can manage holidays
CREATE POLICY "Admins manage holidays" ON company_holidays
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- 2. Modify check constraint on attendance_daily to allow 'WEEKEND' and 'HOLIDAY' (Drop and recreate)
ALTER TABLE attendance_daily DROP CONSTRAINT IF EXISTS attendance_daily_status_check;
ALTER TABLE attendance_daily ADD CONSTRAINT attendance_daily_status_check CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'WEEKEND', 'HOLIDAY'));

-- 3. Replace mark_login RPC to remove late minutes completely
CREATE OR REPLACE FUNCTION mark_login(mode_input TEXT)
RETURNS JSON AS $$
DECLARE
    today DATE := CURRENT_DATE;
    now_time TIMESTAMPTZ := NOW();
    day_of_week INTEGER := EXTRACT(DOW FROM today);
    is_holiday BOOLEAN;
    user_company TEXT;
    calc_status TEXT := 'PRESENT';
BEGIN
    -- Check if already logged in
    IF EXISTS (SELECT 1 FROM attendance_daily WHERE user_id = auth.uid() AND date = today) THEN
        RAISE EXCEPTION 'Attendance already marked for today';
    END IF;

    -- Look up the user's company
    SELECT company INTO user_company FROM profiles WHERE profiles.user_id = auth.uid();

    -- Check if today is a holiday for this company or all companies
    SELECT EXISTS (
        SELECT 1 FROM company_holidays 
        WHERE date = today AND (company IS NULL OR company = user_company)
    ) INTO is_holiday;

    -- Even if it's a Sunday or Holiday, if they choose to log in, we mark them as PRESENT, 
    -- but usually they won't log in. In the Admin view we will handle empty days.
    
    -- Insert Record (No late calculations)
    INSERT INTO attendance_daily (user_id, date, mode, login_time, status, late_minutes)
    VALUES (auth.uid(), today, mode_input, now_time, calc_status, 0);

    RETURN json_build_object('status', 'success', 'message', 'Logged in successfully', 'attendance_status', calc_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
