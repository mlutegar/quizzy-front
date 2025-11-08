-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create topics table (math topics)
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL DEFAULT 'Matemática',
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Topics are viewable by everyone"
  ON public.topics FOR SELECT
  USING (true);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'open')),
  options JSONB, -- for multiple choice: ["option1", "option2", "option3", "option4"]
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  prerequisites TEXT[], -- array of concept names required for this question
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Questions are viewable by everyone"
  ON public.questions FOR SELECT
  USING (true);

-- Create user progress table
CREATE TABLE public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  consecutive_correct INTEGER DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  mastery_percentage INTEGER DEFAULT 0 CHECK (mastery_percentage BETWEEN 0 AND 100),
  last_practiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, topic_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON public.user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.user_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Create user answers history table
CREATE TABLE public.user_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  work_shown TEXT, -- student's work/reasoning
  hints_used INTEGER DEFAULT 0,
  time_spent_seconds INTEGER,
  identified_gap TEXT, -- concept that student struggled with
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own answers"
  ON public.user_answers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own answers"
  ON public.user_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to update user progress
CREATE OR REPLACE FUNCTION update_user_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO user_progress (user_id, topic_id, consecutive_correct, total_attempts, total_correct, last_practiced_at)
  VALUES (
    NEW.user_id,
    NEW.topic_id,
    CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    1,
    CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    NEW.created_at
  )
  ON CONFLICT (user_id, topic_id) DO UPDATE SET
    consecutive_correct = CASE 
      WHEN NEW.is_correct THEN user_progress.consecutive_correct + 1
      ELSE 0
    END,
    total_attempts = user_progress.total_attempts + 1,
    total_correct = CASE 
      WHEN NEW.is_correct THEN user_progress.total_correct + 1
      ELSE user_progress.total_correct
    END,
    mastery_percentage = LEAST(100, GREATEST(0, 
      ROUND((user_progress.total_correct::NUMERIC + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END) / 
            (user_progress.total_attempts::NUMERIC + 1) * 100)::INTEGER
    )),
    last_practiced_at = NEW.created_at,
    updated_at = NEW.created_at;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_answer_created
  AFTER INSERT ON user_answers
  FOR EACH ROW EXECUTE FUNCTION update_user_progress();

-- Insert sample math topics
INSERT INTO public.topics (name, description, icon, order_index) VALUES
('Função do 1º Grau', 'Aprenda sobre funções lineares, gráficos e aplicações práticas', '📈', 1),
('Função do 2º Grau', 'Domine equações quadráticas, parábolas e suas propriedades', '📊', 2),
('Logaritmos', 'Entenda logaritmos, suas propriedades e aplicações', '🔢', 3),
('Trigonometria', 'Explore seno, cosseno, tangente e suas relações', '📐', 4),
('Geometria Analítica', 'Estude pontos, retas e figuras no plano cartesiano', '📏', 5),
('Sequências e Progressões', 'Aprenda sobre PA, PG e suas aplicações', '➗', 6);

-- Insert sample questions for "Função do 1º Grau"
INSERT INTO public.questions (topic_id, question_text, question_type, options, correct_answer, explanation, difficulty, prerequisites)
SELECT 
  id,
  'Determine o valor de x na equação: 2x + 5 = 13',
  'open',
  NULL,
  '4',
  'Para resolver: 2x + 5 = 13, subtraímos 5 de ambos os lados: 2x = 8, então x = 4',
  1,
  ARRAY['operações básicas', 'isolamento de variável']
FROM topics WHERE name = 'Função do 1º Grau';

INSERT INTO public.questions (topic_id, question_text, question_type, options, correct_answer, explanation, difficulty, prerequisites)
SELECT 
  id,
  'Qual é o coeficiente angular da função f(x) = 3x - 7?',
  'multiple_choice',
  '["3", "-7", "3x", "7"]'::jsonb,
  '3',
  'O coeficiente angular (a) é o número que multiplica x. Em f(x) = 3x - 7, o coeficiente angular é 3.',
  2,
  ARRAY['função do 1º grau', 'coeficientes']
FROM topics WHERE name = 'Função do 1º Grau';