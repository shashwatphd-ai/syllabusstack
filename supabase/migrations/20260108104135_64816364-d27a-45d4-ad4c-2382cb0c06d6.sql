-- Fix subscriptions table: restrict to owner only
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

CREATE POLICY "Users can view their own subscription" 
ON public.subscriptions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription" 
ON public.subscriptions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription" 
ON public.subscriptions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Fix job_requirements_cache: restrict to authenticated users only  
DROP POLICY IF EXISTS "Job requirements cache is readable by all" ON public.job_requirements_cache;
DROP POLICY IF EXISTS "Anyone can read job cache" ON public.job_requirements_cache;
DROP POLICY IF EXISTS "Authenticated users can read job cache" ON public.job_requirements_cache;

CREATE POLICY "Authenticated users can read job cache" 
ON public.job_requirements_cache 
FOR SELECT 
USING (auth.uid() IS NOT NULL);