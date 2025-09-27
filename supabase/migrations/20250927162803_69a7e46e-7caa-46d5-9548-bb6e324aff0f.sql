-- Create storage policies for media uploads

-- Policies for media-images bucket
CREATE POLICY "Users can view all images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'media-images');

CREATE POLICY "Users can upload their own images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'media-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'media-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'media-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policies for media-videos bucket
CREATE POLICY "Users can view all videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'media-videos');

CREATE POLICY "Users can upload their own videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'media-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own videos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'media-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own videos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'media-videos' AND auth.uid()::text = (storage.foldername(name))[1]);