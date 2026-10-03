UPDATE public.duels SET selected_categories = selected_categories - 'memory' WHERE selected_categories ? 'memory';
ALTER TABLE public.duels DROP COLUMN IF EXISTS add_memory;
ALTER TABLE public.duels ADD CONSTRAINT duels_no_memory_category CHECK (NOT (selected_categories ? 'memory'));