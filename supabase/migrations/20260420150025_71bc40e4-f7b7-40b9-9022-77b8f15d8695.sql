
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Profile (single row)
CREATE TABLE public.profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL DEFAULT 'Seu Nome',
  description TEXT NOT NULL DEFAULT 'Sua descrição aqui',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profile" ON public.profile
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert profile" ON public.profile
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update profile" ON public.profile
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete profile" ON public.profile
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.profile (display_name, description) VALUES ('Seu Nome', 'Bem-vindo ao meu link na bio');

-- Banners
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT,
  link_url TEXT NOT NULL DEFAULT '#',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view banners" ON public.banners
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert banners" ON public.banners
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update banners" ON public.banners
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete banners" ON public.banners
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profile_updated_at BEFORE UPDATE ON public.profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER banners_updated_at BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('bio-assets', 'bio-assets', true);

CREATE POLICY "Public can view bio assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'bio-assets');
CREATE POLICY "Admins can upload bio assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'bio-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update bio assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'bio-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete bio assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'bio-assets' AND public.has_role(auth.uid(), 'admin'));
