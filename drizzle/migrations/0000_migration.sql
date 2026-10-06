CREATE TABLE public.tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tariffs TO authenticated;
GRANT ALL ON public.tariffs TO service_role;
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all tariffs" ON public.tariffs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  location_name text NOT NULL DEFAULT 'Parkir Saya'
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all settings" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.app_settings (id, location_name) VALUES (1, 'Parkir Saya');

CREATE SEQUENCE public.ticket_seq;
GRANT USAGE ON SEQUENCE public.ticket_seq TO authenticated;

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text NOT NULL UNIQUE DEFAULT ('T' || to_char(now() AT TIME ZONE 'Asia/Jakarta','YYMMDD') || lpad(nextval('public.ticket_seq')::text, 5, '0')),
  plate text NOT NULL,
  category text NOT NULL,
  amount integer NOT NULL,
  paid boolean NOT NULL DEFAULT true,
  entered_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  created_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tickets" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update tickets" ON public.tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX tickets_entered_idx ON public.tickets (entered_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tariffs;

INSERT INTO public.tariffs (name, amount) VALUES ('Motor', 2000), ('Mobil', 5000), ('Truk / Bus', 10000);