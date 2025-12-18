-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  university TEXT,
  major TEXT,
  student_level TEXT CHECK (student_level IN ('freshman', 'sophomore', 'junior', 'senior', 'graduate')),
  graduation_year INTEGER,
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  code TEXT,
  instructor TEXT,
  semester TEXT,
  year INTEGER,
  credits INTEGER DEFAULT 3,
  grade TEXT,
  syllabus_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Courses RLS policies
CREATE POLICY "Users can view their own courses" ON public.courses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own courses" ON public.courses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own courses" ON public.courses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own courses" ON public.courses FOR DELETE USING (auth.uid() = user_id);

-- Create capabilities table (skills extracted from courses)
CREATE TABLE public.capabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  proficiency_level TEXT CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  source TEXT DEFAULT 'course',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on capabilities
ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;

-- Capabilities RLS policies
CREATE POLICY "Users can view their own capabilities" ON public.capabilities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own capabilities" ON public.capabilities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own capabilities" ON public.capabilities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own capabilities" ON public.capabilities FOR DELETE USING (auth.uid() = user_id);

-- Create dream_jobs table
CREATE TABLE public.dream_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  company_type TEXT,
  location TEXT,
  description TEXT,
  salary_range TEXT,
  match_score INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on dream_jobs
ALTER TABLE public.dream_jobs ENABLE ROW LEVEL SECURITY;

-- Dream jobs RLS policies
CREATE POLICY "Users can view their own dream jobs" ON public.dream_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own dream jobs" ON public.dream_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own dream jobs" ON public.dream_jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own dream jobs" ON public.dream_jobs FOR DELETE USING (auth.uid() = user_id);

-- Create job_requirements table
CREATE TABLE public.job_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dream_job_id UUID REFERENCES public.dream_jobs(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  importance TEXT CHECK (importance IN ('required', 'preferred', 'nice_to_have')),
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on job_requirements
ALTER TABLE public.job_requirements ENABLE ROW LEVEL SECURITY;

-- Job requirements RLS policies (inherit from dream_jobs)
CREATE POLICY "Users can view requirements for their dream jobs" ON public.job_requirements 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.dream_jobs WHERE dream_jobs.id = dream_job_id AND dream_jobs.user_id = auth.uid())
  );
CREATE POLICY "Users can insert requirements for their dream jobs" ON public.job_requirements 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.dream_jobs WHERE dream_jobs.id = dream_job_id AND dream_jobs.user_id = auth.uid())
  );
CREATE POLICY "Users can delete requirements for their dream jobs" ON public.job_requirements 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.dream_jobs WHERE dream_jobs.id = dream_job_id AND dream_jobs.user_id = auth.uid())
  );

-- Create recommendations table
CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dream_job_id UUID REFERENCES public.dream_jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('course', 'certification', 'project', 'experience', 'skill')),
  description TEXT,
  provider TEXT,
  url TEXT,
  duration TEXT,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on recommendations
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Recommendations RLS policies
CREATE POLICY "Users can view their own recommendations" ON public.recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own recommendations" ON public.recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recommendations" ON public.recommendations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recommendations" ON public.recommendations FOR DELETE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dream_jobs_updated_at BEFORE UPDATE ON public.dream_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_recommendations_updated_at BEFORE UPDATE ON public.recommendations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();