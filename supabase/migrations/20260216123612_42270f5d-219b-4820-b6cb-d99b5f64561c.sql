
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'employee',
  department TEXT,
  joining_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table for RLS
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
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

-- Attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  punch_in TIMESTAMPTZ,
  punch_out TIMESTAMPTZ,
  worked_hours NUMERIC(4,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'half_day', 'absent', 'on_leave')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Leaves table
CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  leave_type TEXT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  read_status BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for attendance
CREATE POLICY "Users can view own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attendance" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all attendance" ON public.attendance FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for leaves
CREATE POLICY "Users can view own leaves" ON public.leaves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own leaves" ON public.leaves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all leaves" ON public.leaves FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update leaves" ON public.leaves FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to handle new user profile creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, username, role, department, joining_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'employee'),
    NEW.raw_user_meta_data->>'department',
    COALESCE((NEW.raw_user_meta_data->>'joining_date')::date, CURRENT_DATE)
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
