CREATE TABLE public.room_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  sender_name text NOT NULL,
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.room_messages TO authenticated;
GRANT ALL ON public.room_messages TO service_role;

ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read messages of their room"
  ON public.room_messages FOR SELECT TO authenticated
  USING (public.is_duel_participant(duel_id));

CREATE INDEX room_messages_duel_created_idx ON public.room_messages (duel_id, created_at DESC);

ALTER TABLE public.room_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;

CREATE TABLE public.room_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.room_messages(id) ON DELETE SET NULL,
  reporter_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.room_reports TO service_role;

ALTER TABLE public.room_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.duel_players
  ADD COLUMN IF NOT EXISTS muted_by_host boolean NOT NULL DEFAULT false;