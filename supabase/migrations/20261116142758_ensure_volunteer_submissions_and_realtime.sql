-- Keep volunteer inbox changes available to realtime subscribers.
do $$
begin
  alter publication supabase_realtime add table public.volunteer_submissions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end
$$;
