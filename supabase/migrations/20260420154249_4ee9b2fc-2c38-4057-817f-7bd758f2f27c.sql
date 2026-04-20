CREATE POLICY "Public can view bio-assets" ON storage.objects FOR SELECT USING (bucket_id = 'bio-assets');
CREATE POLICY "Admins can upload bio-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'bio-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update bio-assets" ON storage.objects FOR UPDATE USING (bucket_id = 'bio-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete bio-assets" ON storage.objects FOR DELETE USING (bucket_id = 'bio-assets' AND public.has_role(auth.uid(), 'admin'));