CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text),1,6)),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.household_members (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);
GRANT SELECT, UPDATE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
GRANT SELECT ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member(_hid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.household_members WHERE household_id=_hid AND user_id=auth.uid())
$$;

CREATE POLICY "members read household" ON public.households FOR SELECT TO authenticated USING (public.is_member(id));
CREATE POLICY "members update household" ON public.households FOR UPDATE TO authenticated USING (public.is_member(id)) WITH CHECK (public.is_member(id));
CREATE POLICY "members read members" ON public.household_members FOR SELECT TO authenticated USING (public.is_member(household_id));

CREATE OR REPLACE FUNCTION public.create_household(_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT household_id INTO hid FROM household_members WHERE user_id=auth.uid();
  IF hid IS NOT NULL THEN RETURN hid; END IF;
  INSERT INTO households(data) VALUES (_data) RETURNING id INTO hid;
  INSERT INTO household_members(household_id,user_id) VALUES (hid, auth.uid());
  RETURN hid;
END $$;

CREATE OR REPLACE FUNCTION public.join_household(_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid; n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO hid FROM households WHERE invite_code=upper(trim(_code));
  IF hid IS NULL THEN RAISE EXCEPTION 'Código inválido'; END IF;
  SELECT count(*) INTO n FROM household_members WHERE household_id=hid;
  IF n >= 2 THEN RAISE EXCEPTION 'Este casal já tem duas pessoas'; END IF;
  DELETE FROM household_members WHERE user_id=auth.uid();
  INSERT INTO household_members(household_id,user_id) VALUES (hid, auth.uid());
  RETURN hid;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_household(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_household(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_household(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_household(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER households_touch BEFORE UPDATE ON public.households FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.households;