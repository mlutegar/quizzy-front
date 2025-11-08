import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  type: string;
  topic: string;
  topic_id: string;
  topic_name: string;
  concepts: string[];
  is_diagnostic: boolean;
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

interface DiagnosticResults {
  overall_accuracy: number;
  total_questions: number;
  total_correct: number;
  topic_performance: Record<string, any>;
  mastered_topics: string[];
  recommended_path: {
    path_name: string;
    path_title: string;
    description: string;
    reason: string;
    path_topics: string[];
    start_topic: string;
  };
  next_topics: Array<{
    topic_id: string;
    name: string;
    description: string;
  }>;
  message: string;
}

const Diagnostic = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [studentId, setStudentId] = useState<string>("");
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
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResults | null>(null);

  useEffect(() => {
    initializeDiagnostic();
  }, []);

  const initializeDiagnostic = async () => {
    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const userId = user.id;
      setStudentId(userId);

      // Check diagnostic status
      console.log("📡 GET para:", `${FLASK_API_URL}/diagnostic/${userId}/status`);
      const statusResponse = await fetch(`${FLASK_API_URL}/diagnostic/${userId}/status`);
      const statusData = await statusResponse.json();

      console.log("✅ Status:", statusData);

      if (statusData.diagnostic_completed) {
        toast({
          title: "Diagnóstico já completo",
          description: "Você já completou o teste diagnóstico!",
        });
        navigate("/matematica");
        return;
      }

      // Start diagnostic test
      await startDiagnosticTest(userId);
    } catch (error: any) {
      console.error("Erro ao inicializar diagnóstico:", error);
      toast({
        title: "Erro ao iniciar diagnóstico",
        description: error.message,
        variant: "destructive",
      });
      navigate("/matematica");
    }
  };

  const startDiagnosticTest = async (userId: string) => {
    try {
      const startBody = {
        student_id: userId,
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

      const data = await response.json();
      console.log("✅ Teste iniciado:", data);

      toast({
        title: "Teste Diagnóstico Iniciado",
        description: `${data.total_questions} questões sobre ${data.topics_covered} tópicos`,
      });

      await loadNextQuestion(userId);
    } catch (error: any) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadNextQuestion = async (userId: string) => {
    try {
      console.log("📡 GET para:", `${FLASK_API_URL}/diagnostic/${userId}/next`);
      const response = await fetch(`${FLASK_API_URL}/diagnostic/${userId}/next`);
      
      if (!response.ok) throw new Error("Erro ao carregar questão");

      const data: DiagnosticResponse = await response.json();
      console.log("✅ Próxima questão:", data);

      if (data.status === "test_completed") {
        toast({
          title: "🎉 Teste Completo!",
          description: "Avaliando seus resultados...",
        });
        // O resultado virá no submit da última questão
        return;
      }

      if (data.question) {
        setCurrentQuestion(data.question);
        setQuestionNumber(data.question_number || 1);
        setTotalQuestions(data.total_questions || 15);
        
        // Initialize answers array if needed
        if (answers.length === 0) {
          setAnswers(new Array(data.total_questions || 15).fill(null));
        }
      }
    } catch (error: any) {
      console.error("Erro ao carregar questão:", error);
      toast({
        title: "Erro ao carregar questão",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !currentQuestion || !studentId) {
      toast({
        title: "Resposta vazia",
        description: "Por favor, responda à questão antes de verificar.",
        variant: "destructive",
      });
      return;
    }

    setChecking(true);

    try {
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
      console.log("✅ Resposta submetida:", data);

      setIsCorrect(data.is_correct || false);
      setSolutionSteps(data.solution_steps || []);
      
      // Update answers array
      const newAnswers = [...answers];
      newAnswers[questionNumber - 1] = data.is_correct || false;
      setAnswers(newAnswers);

      setShowFeedback(true);

      // Check if test is completed
      if (data.status === "test_completed" && data.diagnostic_results) {
        setDiagnosticResults(data.diagnostic_results);
      }
    } catch (error: any) {
      console.error("Erro ao verificar resposta:", error);
      toast({
        title: "Erro ao verificar resposta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleNext = async () => {
    if (diagnosticResults) {
      // Show results screen
      return;
    }

    setUserAnswer("");
    setShowFeedback(false);
    setSolutionSteps([]);
    await loadNextQuestion(studentId);
  };

  const handleFinishDiagnostic = () => {
    toast({
      title: "Diagnóstico Completo!",
      description: "Redirecionando para seus tópicos personalizados...",
    });
    navigate("/matematica");
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

  // Show diagnostic results
  if (diagnosticResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-success/10">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-2xl">🎉 Teste Diagnóstico Completo!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overall Performance */}
              <div className="bg-primary/5 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Desempenho Geral</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-primary">
                      {Math.round(diagnosticResults.overall_accuracy * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Acurácia</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-success">
                      {diagnosticResults.total_correct}
                    </div>
                    <div className="text-sm text-muted-foreground">Acertos</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-muted-foreground">
                      {diagnosticResults.total_questions}
                    </div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>
              </div>

              {/* Recommended Path */}
              <div className="bg-card rounded-lg p-6 border-2 border-primary">
                <h3 className="text-lg font-semibold mb-2">📚 Seu Caminho de Aprendizado</h3>
                <h4 className="text-xl font-bold text-primary mb-2">
                  {diagnosticResults.recommended_path.path_title}
                </h4>
                <p className="text-muted-foreground mb-2">
                  {diagnosticResults.recommended_path.description}
                </p>
                <p className="text-sm italic">
                  Motivo: {diagnosticResults.recommended_path.reason}
                </p>
              </div>

              {/* Mastered Topics */}
              {diagnosticResults.mastered_topics.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">✅ Tópicos Dominados</h3>
                  <div className="flex flex-wrap gap-2">
                    {diagnosticResults.mastered_topics.map((topicId) => (
                      <span
                        key={topicId}
                        className="px-3 py-1 bg-success/10 text-success rounded-full text-sm font-medium"
                      >
                        {diagnosticResults.topic_performance[topicId]?.name || topicId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Topics */}
              {diagnosticResults.next_topics && diagnosticResults.next_topics.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">🎯 Próximos Tópicos</h3>
                  <div className="space-y-2">
                    {diagnosticResults.next_topics.map((topic) => (
                      <Card key={topic.topic_id}>
                        <CardContent className="py-3">
                          <h4 className="font-semibold">{topic.name}</h4>
                          <p className="text-sm text-muted-foreground">{topic.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Topic Performance */}
              <div>
                <h3 className="text-lg font-semibold mb-3">📊 Desempenho por Tópico</h3>
                <div className="space-y-2">
                  {Object.entries(diagnosticResults.topic_performance).map(([topicId, perf]: [string, any]) => (
                    <div key={topicId} className="flex items-center justify-between p-3 bg-card rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{perf.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {perf.questions_answered} questões
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {Math.round(perf.accuracy * 100)}%
                          </div>
                        </div>
                        {perf.is_mastered && (
                          <CheckCircle className="w-6 h-6 text-success" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleFinishDiagnostic} className="w-full" size="lg">
                Começar Aprendizado Personalizado
              </Button>
            </CardContent>
          </Card>
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
                    Teste Diagnóstico
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Avaliando seu conhecimento para personalizar seu aprendizado
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
            <div className="space-y-2">
              <Label>Sua resposta</Label>
              <Input
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Digite sua resposta..."
                disabled={showFeedback}
              />
            </div>

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
                      
                      {solutionSteps.length > 0 && (
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
            ) : (
              <Button onClick={handleNext} className="w-full" size="lg">
                {diagnosticResults ? "Ver Resultados" : "Próxima Questão"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Diagnostic;
