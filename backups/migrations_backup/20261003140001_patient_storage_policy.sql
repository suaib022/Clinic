-- Allow patients to upload and read their own records in storage
CREATE POLICY "Patients can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'medical_documents' AND 
    (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'patient'))
);

CREATE POLICY "Patients can read files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'medical_documents' AND 
    (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'patient'))
);
