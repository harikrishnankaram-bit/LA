-- Drop the existing constraint
ALTER TABLE public.leaves 
DROP CONSTRAINT IF EXISTS leaves_status_check;

-- Add the updated constraint that includes CANCEL_REQUESTED and CANCELLED
ALTER TABLE public.leaves 
ADD CONSTRAINT leaves_status_check 
CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCEL_REQUESTED', 'CANCELLED'));
