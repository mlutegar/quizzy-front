import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { QuestionIndicators } from "@/components/QuestionIndicators";
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const FLASK_API_URL = "http://localhost:5000";

interface DiagnosticQuestion {
  question_id: string;
  problem: string;
  equation: string;
  difficulty: string;
  topic_id: string;
  topic_name: string;
  concepts: string[];
  is_diagnostic: boolean;
  options?: string[];
  question_type?: "multiple_choice" | "open";
}

interface DiagnosticResponse {
  status: string;
  question_number?: number;
  total_questions?: number;
  progress_percentage?: number;
  question?: DiagnosticQuestion;
  is_correct?: boolean;
  correct_answer?: string;
  solution_steps?: string[];
  next_question?: any;
  diagnostic_results?: any;
  message?: string;
}

const Diagnostic = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const studentId = "student_123"; // TODO: Get from auth context
  const [topicName, setTopicName] = useState("");
  
  const [currentQuestion, setCurrentQuestion] = useState<DiagnosticQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(15);
  const [userAnswer, setUserAnswer] = useState("");
  const [answers, setAnswers] = useState<(boolean | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [solutionSteps, setSolutionSteps] = useState<string[]>([]);

  useEffect(() => {
    startDiagnosticTest();
  }, []);

  const startDiagnosticTest = async () => {
    if (!topicId) {
      navigate(-1);
      return;
    }

    try {
      const startBody = {
        student_id: studentId,
        topic_id: topicId,
        questions_per_topic: 3,
      };

      console.log("📡 POST para:", `${FLASK_API_URL}/diagnostic/start`);
      console.log("📤 POST BODY:", JSON.stringify(startBody, null, 2));

      const response = await fetch(`${FLASK_API_URL}/diagnostic/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(startBody),
      });

      if (!response.ok) throw new Error("Erro ao iniciar teste diagnóstico");

      await loadNextQuestion();
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar teste",
        description: error.message,
        variant: "destructive",
      });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const generateQuestionsForTopic = async () => {
    try {
      toast({
        title: "🎉 Teste Diagnóstico Completo!",
        description: "Gerando questões personalizadas...",
      });

      // Get student progress to determine difficulty
      const progressResponse = await fetch(`${FLASK_API_URL}/progress/${studentId}`);
      if (!progressResponse.ok) throw new Error("Erro ao buscar progresso");
      
      const progressData = await progressResponse.json();
      
      // Determine difficulty based on learning path or accuracy
      let difficulty = "medium";
      if (progressData.learning_path === "beginner") {
        difficulty = "easy";
      } else if (progressData.learning_path === "advanced") {
        difficulty = "hard";
      }

      // Generate questions
      const generateBody = {
        count: 10,
        difficulty: difficulty,
      };

      console.log("📡 POST para:", `${FLASK_API_URL}/questions/generate`);
      console.log("📤 POST BODY:", JSON.stringify(generateBody, null, 2));

      const generateResponse = await fetch(`${FLASK_API_URL}/questions/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(generateBody),
      });

      if (!generateResponse.ok) throw new Error("Erro ao gerar questões");

      const questionsData = await generateResponse.json();

      // Save questions to Supabase so Quiz page can load them
      if (questionsData.questions && questionsData.questions.length > 0) {
        const questionsToSave = questionsData.questions.map((q: any) => ({
          topic_id: topicId,
          question_text: q.problem,
          question_type: "open" as const,
          options: null,
          correct_answer: String(q.answer),
          explanation: q.steps?.join("\n") || "",
          prerequisites: [],
        }));

        const { error: insertError } = await supabase
          .from("questions")
          .insert(questionsToSave);

        if (insertError) {
          console.error("Erro ao salvar questões:", insertError);
          throw new Error("Erro ao salvar questões");
        }
      }

      toast({
        title: "Questões Geradas!",
        description: "Redirecionando para o quiz...",
      });

      setTimeout(() => navigate(`/quiz/${topicId}`), 1500);
    } catch (error: any) {
      toast({
        title: "Erro ao gerar questões",
        description: error.message,
        variant: "destructive",
      });
      // Navigate anyway
      setTimeout(() => navigate(`/quiz/${topicId}`), 2000);
    }
  };

  const loadNextQuestion = async () => {
    try {
      const response = await fetch(`${FLASK_API_URL}/diagnostic/${studentId}/next`);
      
      if (!response.ok) throw new Error("Erro ao carregar questão");

      const data: DiagnosticResponse = await response.json();

      if (data.status === "test_completed") {
        await generateQuestionsForTopic();
        return;
      }

      if (data.question) {
        setCurrentQuestion(data.question);
        setQuestionNumber(data.question_number || 1);
        setTotalQuestions(data.total_questions || 15);
        setTopicName(data.question.topic_name || "");
        
        // Initialize answers array if needed
        if (answers.length === 0) {
          setAnswers(new Array(data.total_questions || 15).fill(null));
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar questão",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !currentQuestion) {
      toast({
        title: "Resposta vazia",
        description: "Por favor, responda à questão antes de verificar.",
        variant: "destructive",
      });
      return;
    }

    setChecking(true);

    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado",
          variant: "destructive",
        });
        return;
      }

      const submitBody = {
        question_id: currentQuestion.question_id,
        answer: userAnswer,
      };

      console.log("📡 POST para:", `${FLASK_API_URL}/diagnostic/${studentId}/submit`);
      console.log("📤 POST BODY:", JSON.stringify(submitBody, null, 2));

      const response = await fetch(`${FLASK_API_URL}/diagnostic/${studentId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitBody),
      });

      if (!response.ok) throw new Error("Erro ao submeter resposta");

      const data: DiagnosticResponse = await response.json();

      setIsCorrect(data.is_correct || false);
      setSolutionSteps(data.solution_steps || []);
      
      // Update answers array
      const newAnswers = [...answers];
      newAnswers[questionNumber - 1] = data.is_correct || false;
      setAnswers(newAnswers);

      // Save answer to Supabase
      const { error: saveError } = await supabase
        .from("user_answers")
        .insert({
          user_id: user.id,
          question_id: currentQuestion.question_id,
          topic_id: topicId!,
          user_answer: userAnswer,
          is_correct: data.is_correct || false,
          work_shown: "",
          hints_used: 0,
        });

      if (saveError) {
        console.error("Erro ao salvar resposta no Supabase:", saveError);
      }

      setShowFeedback(true);

      // If test is completed, generate questions
      if (data.status === "test_completed") {
        await generateQuestionsForTopic();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao verificar resposta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleSkipQuestion = async () => {
    if (!currentQuestion) return;

    setChecking(true);
    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado",
          variant: "destructive",
        });
        return;
      }

      // Submit empty answer to API so it knows we're skipping
      const skipBody = {
        question_id: currentQuestion.question_id,
        answer: "", // Empty answer = skipped
      };

      console.log("📡 POST para (skip):", `${FLASK_API_URL}/diagnostic/${studentId}/submit`);
      console.log("📤 POST BODY:", JSON.stringify(skipBody, null, 2));

      await fetch(`${FLASK_API_URL}/diagnostic/${studentId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(skipBody),
      });

      // Save skipped answer to Supabase as incorrect
      await supabase
        .from("user_answers")
        .insert({
          user_id: user.id,
          question_id: currentQuestion.question_id,
          topic_id: topicId!,
          user_answer: "",
          is_correct: false,
          work_shown: "",
          hints_used: 0,
        });

      // Update answers array to show skipped (null)
      const newAnswers = [...answers];
      newAnswers[questionNumber - 1] = null;
      setAnswers(newAnswers);

      // Load next question
      setUserAnswer("");
      setShowFeedback(false);
      setSolutionSteps([]);
      await loadNextQuestion();
    } catch (error: any) {
      toast({
        title: "Erro ao pular questão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleNext = async () => {
    setUserAnswer("");
    setShowFeedback(false);
    setSolutionSteps([]);
    await loadNextQuestion();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Preparando teste diagnóstico...</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const correctCount = answers.filter(a => a === true).length;
  const progress = totalQuestions > 0 ? (questionNumber / totalQuestions) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-success/10">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>

          {/* Diagnostic Banner */}
          <Card className="mb-6 border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🔍</div>
                <div>
                  <h2 className="text-lg font-semibold">
                    Sessão de Diagnóstico {topicName && `- ${topicName}`}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Este teste avalia seu conhecimento neste tópico para personalizar seu aprendizado
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          <div className="bg-card rounded-lg p-4 shadow-sm mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Questão {questionNumber} de {totalQuestions}
              </h2>
              <div className="text-sm">
                <span className="text-success font-semibold">✓ {correctCount}</span>
                <span className="text-muted-foreground mx-2">|</span>
                <span className="text-muted-foreground">
                  {Math.round(progress)}% completo
                </span>
              </div>
            </div>
            <QuestionIndicators
              total={totalQuestions}
              current={questionNumber - 1}
              answers={answers}
            />
          </div>
        </div>

        {/* Question Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                {currentQuestion.topic_name}
              </span>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-muted">
                {currentQuestion.difficulty}
              </span>
            </div>
            <CardTitle className="text-xl leading-relaxed">
              {currentQuestion.problem}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Answer Input */}
            {currentQuestion.question_type === "multiple_choice" && currentQuestion.options ? (
              <RadioGroup value={userAnswer} onValueChange={setUserAnswer}>
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <RadioGroupItem value={option} id={`option-${index}`} />
                      <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            ) : (
              <div className="space-y-2">
                <Label>Sua resposta</Label>
                <Input
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Digite sua resposta..."
                  disabled={showFeedback}
                />
              </div>
            )}

            {/* Feedback */}
            {showFeedback && (
              <Card className={cn(
                "border-l-4",
                isCorrect ? "border-l-success bg-success/5" : "border-l-destructive bg-destructive/5"
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 mb-4">
                    {isCorrect ? (
                      <CheckCircle className="w-6 h-6 text-success flex-shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">
                        {isCorrect ? "Resposta Correta! ✅" : "Resposta Incorreta ❌"}
                      </h3>
                      
                      {!isCorrect && solutionSteps.length > 0 && (
                        <div className="space-y-2 mt-3">
                          <p className="text-sm font-semibold">Solução:</p>
                          <div className="text-sm space-y-1 font-mono bg-background/50 p-3 rounded">
                            {solutionSteps.map((step, idx) => (
                              <div key={idx}>{step}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {!showFeedback ? (
              <div className="space-y-3">
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={checking || !userAnswer}
                  className="w-full"
                  size="lg"
                >
                  {checking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Verificar Resposta"
                  )}
                </Button>
                <Button
                  onClick={handleSkipQuestion}
                  disabled={checking}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Pular Questão
                </Button>
              </div>
            ) : (
              <Button onClick={handleNext} className="w-full" size="lg">
                Próxima Questão
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Diagnostic;
