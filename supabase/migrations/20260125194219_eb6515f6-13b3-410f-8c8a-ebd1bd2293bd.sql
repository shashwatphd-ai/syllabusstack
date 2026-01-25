-- Enable realtime for batch_jobs table to allow live progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.batch_jobs;