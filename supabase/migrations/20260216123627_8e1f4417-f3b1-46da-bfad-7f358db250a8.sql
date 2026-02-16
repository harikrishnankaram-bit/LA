
-- Fix the overly permissive notification insert policy
DROP POLICY "System can insert notifications" ON public.notifications;

-- Replace with a proper policy: allow authenticated users to insert notifications (controlled by edge function)
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
