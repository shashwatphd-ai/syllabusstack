-- Drop the old narrow policy since the new one already covers self-access
DROP POLICY "Users can view their own profile" ON public.profiles;