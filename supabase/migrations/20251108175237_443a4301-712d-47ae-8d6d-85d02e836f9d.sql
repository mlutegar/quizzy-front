-- Allow authenticated users to insert questions
CREATE POLICY "Authenticated users can insert questions"
ON public.questions
FOR INSERT
TO authenticated
WITH CHECK (true);