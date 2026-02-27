-- ============================================================
-- FULL SETUP SCRIPT — Attendance System
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Run ALL at once (select all, then click Run)
-- ============================================================


-- ============================================================
-- STEP 1: ENUM TYPE
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'employee');


-- ============================================================
-- STEP 2: PROFILES TABLE
-- Stores employee details. Auto-populated via trigger on signup.
-- ============================================================

CREATE TABLE public.profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name    TEXT        NOT NULL,
  username     TEXT        NOT NULL UNIQUE,
  role         app_role    NOT NULL DEFAULT 'employee',
  department   TEXT,
  joining_date DATE,
  company      TEXT        DEFAULT 'Tensemi',
  phone_number TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 3: USER_ROLES TABLE
-- Used by RLS policies to check admin/employee roles.
-- ============================================================

CREATE TABLE public.user_roles (
  id      UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID     REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role    app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 4: ATTENDANCE_DAILY TABLE
-- Main attendance tracking table (punch-in / punch-out per day)
-- ============================================================

CREATE TABLE public.attendance_daily (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  mode         TEXT        CHECK (mode IN ('WFO', 'WFH')),
  login_time   TIMESTAMPTZ,
  logout_time  TIMESTAMPTZ,
  status       TEXT        CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'WEEKEND', 'HOLIDAY')),
  late_minutes INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.attendance_daily ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 5: LEAVES TABLE
-- Employee leave requests with approval workflow.
-- ============================================================

CREATE TABLE public.leaves (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  leave_type    TEXT        NOT NULL,
  from_date     DATE        NOT NULL,
  to_date       DATE        NOT NULL,
  reason        TEXT,
  status        TEXT        NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCEL_REQUESTED', 'CANCELLED')),
  admin_comment TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 6: NOTIFICATIONS TABLE
-- In-app notifications for employees (realtime enabled).
-- ============================================================

CREATE TABLE public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message     TEXT        NOT NULL,
  read_status BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Enable realtime on notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- ============================================================
-- STEP 7: COMPANY HOLIDAYS TABLE
-- Admin-managed list of company holidays.
-- ============================================================

CREATE TABLE public.company_holidays (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE        NOT NULL,
  name       TEXT        NOT NULL,
  company    TEXT,       -- NULL = applies to all companies
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, company)
);

ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 8: HELPER FUNCTION — has_role()
-- Used inside RLS policies to check if a user is admin/employee.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


-- ============================================================
-- STEP 9: TRIGGER FUNCTION — handle_new_user()
-- Automatically creates a profile + user_role entry when
-- a new user is created via supabase.auth.admin.createUser()
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, username, role, department, joining_date, company, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'employee'),
    NEW.raw_user_meta_data->>'department',
    COALESCE((NEW.raw_user_meta_data->>'joining_date')::date, CURRENT_DATE),
    COALESCE(NEW.raw_user_meta_data->>'company', 'Tensemi'),
    NEW.raw_user_meta_data->>'phone_number'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'employee')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- STEP 10: RPC FUNCTION — mark_login(mode_input TEXT)
-- Called by employees when they punch in.
-- Records attendance: PRESENT if on time, LATE otherwise.
-- Also checks for holidays.
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_login(mode_input TEXT)
RETURNS JSON AS $$
DECLARE
  today        DATE        := CURRENT_DATE;
  now_time     TIMESTAMPTZ := NOW();
  is_holiday   BOOLEAN;
  user_company TEXT;
  calc_status  TEXT        := 'PRESENT';
BEGIN
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


-- ============================================================
-- STEP 11: RPC FUNCTION — mark_logout()
-- Called by employees when they punch out.
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_logout()
RETURNS JSON AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  UPDATE attendance_daily
  SET logout_time = NOW()
  WHERE user_id = auth.uid()
    AND date = today
    AND logout_time IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active login found or already logged out';
  END IF;

  RETURN json_build_object('status', 'success', 'message', 'Logged out successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- STEP 12: RLS POLICIES — profiles
-- ============================================================

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role bypass (needed for adminClient.auth.admin.createUser trigger)
CREATE POLICY "Service role full access on profiles"
  ON public.profiles FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- STEP 13: RLS POLICIES — user_roles
-- ============================================================

CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access on user_roles"
  ON public.user_roles FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- STEP 14: RLS POLICIES — attendance_daily
-- ============================================================

CREATE POLICY "Employees view own records"
  ON public.attendance_daily FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all attendance"
  ON public.attendance_daily FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role full access on attendance_daily"
  ON public.attendance_daily FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- STEP 15: RLS POLICIES — leaves
-- ============================================================

CREATE POLICY "Users can view own leaves"
  ON public.leaves FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leaves"
  ON public.leaves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leaves"
  ON public.leaves FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all leaves"
  ON public.leaves FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update leaves"
  ON public.leaves FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access on leaves"
  ON public.leaves FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- STEP 16: RLS POLICIES — notifications
-- ============================================================

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role full access on notifications"
  ON public.notifications FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- STEP 17: RLS POLICIES — company_holidays
-- ============================================================

CREATE POLICY "Public read access for holidays"
  ON public.company_holidays FOR SELECT
  USING (true);

CREATE POLICY "Admins manage holidays"
  ON public.company_holidays FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role full access on holidays"
  ON public.company_holidays FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- DONE! ✅
-- Next Steps:
-- 1. Copy your new Project URL and Anon Key from:
--    Supabase Dashboard → Project Settings → API
-- 2. Update your .env file with the new values
-- 3. The admin user will be created from your app's
--    EmployeesPage using adminClient (no manual setup needed)
-- ============================================================
