import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle, XCircle, Loader2, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const FLASK_API_URL = "http://localhost:5000";

interface AdaptiveQuestion {
  id: string;
  problem: string;
  equation: string;
  answer: string | number;
  steps: string[];
  difficulty: string;
  type: string;
  topic: string;
  concepts: string[];
  topic_id: string;
}

interface HintResponse {
  hint: string;
  hint_level: number;
  hint_type: string;
  encouragement: string;
}

const AdaptiveLearning = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [studentId, setStudentId] = useState<string>("");
  const [currentQuestion, setCurrentQuestion] = useState<AdaptiveQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [errorAnalysis, setErrorAnalysis] = useState("");
  const [sessionComplete, setSessionComplete] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [topicName, setTopicName] = useState("");
  const [currentHint, setCurrentHint] = useState("");
  const [hintLevel, setHintLevel] = useState(0);
  const [loadingHint, setLoadingHint] = useState(false);

  useEffect(() => {
    startAdaptiveSession();
  }, []);

  const startAdaptiveSession = async () => {
    try {
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

      setStudentId(user.id);

      const startBody = {
        student_id: user.id,
        learning_path: "intermediate", // Could be dynamic based on diagnostic results
      };
      
      console.log("📡 POST para:", `${FLASK_API_URL}/adaptive/start`);
      console.log("📤 POST BODY:", JSON.stringify(startBody, null, 2));
      
      const response = await fetch(`${FLASK_API_URL}/adaptive/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(startBody),
      });
      
      if (!response.ok) {
        const data = await response.json();
        if (data.status === "diagnostic_required") {
          toast({
            title: "Diagnóstico Necessário",
            description: data.message || "Complete o teste diagnóstico primeiro",
            variant: "destructive",
          });
          navigate("/diagnostic");
          return;
        }
        throw new Error("Erro ao iniciar sessão adaptativa");
      }

      const data = await response.json();
      console.log("✅ Sessão iniciada:", data);
      console.log("📋 Student ID usado:", user.id);
      console.log("📋 Status da sessão:", data.status);
      
      if (data.status === "ready") {
        setTopicName(data.topic_name || "Aprendizagem Adaptativa");
        toast({
          title: "Sessão Iniciada",
          description: `Vamos trabalhar: ${data.topic_name}`,
        });
        await getNextQuestion(user.id);
      } else {
        throw new Error(`Status inesperado: ${data.status}`);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const getNextQuestion = async (userId: string) => {
    setLoading(true);
    try {
      console.log("📡 GET para:", `${FLASK_API_URL}/adaptive/${userId}/next`);
      
      const response = await fetch(`${FLASK_API_URL}/adaptive/${userId}/next`);
      
      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json().catch(() => null);
          console.error("❌ Sessão não encontrada ao buscar questão:", errorData);
          toast({
            title: "Sessão Perdida",
            description: "Reiniciando sessão adaptativa...",
            variant: "destructive",
          });
          // Reiniciar sessão
          await startAdaptiveSession();
          return;
        }
        throw new Error("Erro ao obter questão");
      }

      const data = await response.json();
      console.log("✅ Questão ORIGINAL recebida da API:", JSON.stringify(data, null, 2));
      console.log("📋 Campos disponíveis:", Object.keys(data));
      
      // Mapear a resposta da API para o formato esperado
      const mappedQuestion: AdaptiveQuestion = {
        id: data.id || data.question_id || `q_${Date.now()}`, // gerar ID se não existir
        problem: data.problem || "",
        equation: data.equation || "",
        answer: data.answer || "",
        steps: data.steps || data.solution_steps || [],
        difficulty: data.difficulty || "medium",
        type: data.type || "",
        topic: data.topic || data.topic_id || "",
        concepts: data.concepts || data.concepts_tested || [],
        topic_id: data.topic_id || "",
      };
      
      console.log("✅ Questão MAPEADA:", JSON.stringify(mappedQuestion, null, 2));
      console.log("📋 ID final:", mappedQuestion.id);
      console.log("📋 Concepts final:", mappedQuestion.concepts);
      
      setCurrentQuestion(mappedQuestion);
      setCurrentHint("");
      setHintLevel(0);
    } catch (error: any) {
      console.error("Erro ao buscar questão:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const requestHint = async () => {
    if (!currentQuestion || !studentId) return;

    // Validar dados antes de enviar
    if (!currentQuestion.problem) {
      toast({
        title: "Erro",
        description: "Enunciado da questão não encontrado",
        variant: "destructive",
      });
      return;
    }

    setLoadingHint(true);
    try {
      const startBody = {
        problem: currentQuestion.problem,
      };

      console.log("📡 POST para:", `${FLASK_API_URL}/start`);
      console.log("📤 POST BODY:", JSON.stringify(startBody, null, 2));

      const response = await fetch(`${FLASK_API_URL}/start`, {
        method: "POST",
        headers: { 
          "Accept": "application/json",
          "Content-Type": "application/json" 
        },
        body: JSON.stringify(startBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("❌ Erro ao iniciar sessão de ajuda:", errorData);
        throw new Error(errorData?.error || `Erro ${response.status} ao obter ajuda`);
      }

      const data = await response.json();
      console.log("✅ Sessão de ajuda iniciada:", data);

      // Adicionar a resposta do professor ao chat
      setCurrentHint(data.question || data.message || "Vou te ajudar com essa questão!");

      toast({
        title: "💡 Professor IA",
        description: "Confira a orientação abaixo da questão",
      });
    } catch (error: any) {
      console.error("💥 Erro ao pedir ajuda:", error);
      toast({
        title: "Erro ao pedir ajuda",
        description: error.message || "Erro ao conectar com o Professor IA",
        variant: "destructive",
      });
    } finally {
      setLoadingHint(false);
    }
  };

  const submitAnswer = async () => {
    if (!userAnswer.trim() || !currentQuestion || !studentId) {
      toast({
        title: "Resposta vazia",
        description: "Por favor, responda à questão antes de verificar.",
        variant: "destructive",
      });
      return;
    }

    // Validação crítica do question_id
    if (!currentQuestion.id) {
      console.error("❌ ERRO CRÍTICO: currentQuestion.id está undefined!");
      console.error("🔍 currentQuestion completo:", currentQuestion);
      toast({
        title: "Erro",
        description: "ID da questão não encontrado. Recarregando questão...",
        variant: "destructive",
      });
      await getNextQuestion(studentId);
      return;
    }

    console.log("🔍 Validação pré-submit:");
    console.log("  - currentQuestion.id:", currentQuestion.id);
    console.log("  - studentId:", studentId);

    setChecking(true);
    try {
      const submitBody = {
        question_id: currentQuestion.id,
        question: currentQuestion.problem,
        student_answer: userAnswer,
        correct_answer: String(currentQuestion.answer),
        solution_steps: currentQuestion.steps || [],
        concepts_tested: currentQuestion.concepts || [],
      };

      console.log("📡 POST para:", `${FLASK_API_URL}/adaptive/${studentId}/submit`);
      console.log("📤 POST BODY:", JSON.stringify(submitBody, null, 2));

      const response = await fetch(`${FLASK_API_URL}/adaptive/${studentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("❌ Erro na resposta:", errorData);
        
        // Sessão não encontrada - reiniciar
        if (response.status === 404 && errorData?.error?.includes("session not found")) {
          toast({
            title: "Sessão Expirada",
            description: "Reiniciando sua sessão adaptativa...",
            variant: "destructive",
          });
          
          // Reiniciar sessão
          await startAdaptiveSession();
          return;
        }
        
        throw new Error(errorData?.error || `Erro ao submeter resposta: ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Resposta submetida:", data);

      setIsCorrect(data.is_correct);
      setShowFeedback(true);
      setQuestionsAnswered(prev => prev + 1);

      if (data.error_analysis) {
        setErrorAnalysis(data.error_analysis.explanation || "");
      }

      if (data.hint && !data.is_correct) {
        setCurrentHint(data.hint);
      }

      if (data.status === "topic_mastered") {
        toast({
          title: "🎉 Tópico Dominado!",
          description: data.message,
        });
        setTimeout(() => {
          setSessionComplete(true);
        }, 2000);
      } else if (data.status === "prerequisite_required") {
        toast({
          title: "Pré-requisito necessário",
          description: data.message,
        });
      } else if (data.status === "difficulty_reduced") {
        toast({
          title: "Ajustando dificuldade",
          description: data.message,
        });
      }
    } catch (error: any) {
      console.error("💥 Erro ao submeter:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleNext = async () => {
    setShowFeedback(false);
    setUserAnswer("");
    setErrorAnalysis("");
    setCurrentHint("");
    setHintLevel(0);
    await getNextQuestion(studentId);
  };

  const handleFinish = () => {
    toast({
      title: "Sessão Finalizada",
      description: `Você respondeu ${questionsAnswered} questões adaptativas.`,
    });
    navigate("/matematica");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Preparando aprendizagem adaptativa...</p>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-success/10">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">Parabéns!</h2>
            <p className="text-muted-foreground mb-2">
              Você completou a sessão de aprendizagem adaptativa com sucesso!
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Total de questões: {questionsAnswered}
            </p>
            <Button onClick={handleFinish} className="w-full" size="lg">
              Voltar para Tópicos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando questão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-success/10">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={handleFinish} className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>

          {/* Adaptive Learning Banner */}
          <Card className="mb-6 border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🧠</div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">
                    Aprendizagem Adaptativa
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {topicName || "Sistema adaptando questões ao seu nível"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{questionsAnswered}</div>
                  <div className="text-xs text-muted-foreground">questões</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Question Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                {currentQuestion.topic}
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
              <label className="text-sm font-medium">Sua resposta</label>
              <Input
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Digite sua resposta..."
                disabled={showFeedback}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !showFeedback) {
                    submitAnswer();
                  }
                }}
              />
            </div>

            {/* Progressive Hint */}
            {!showFeedback && currentHint && (
              <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        💡 Dica Nível {hintLevel + 1}
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {currentHint}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                        {isCorrect ? "Resposta Correta! 🎉" : "Resposta Incorreta"}
                      </h3>
                      
                      <p className="text-sm mb-3">
                        ✓ Resposta correta: {currentQuestion.answer}
                      </p>

                      <div className="space-y-2 mb-3">
                        <p className="text-sm font-semibold">📝 Passos da solução:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          {currentQuestion.steps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                      
                      {!isCorrect && errorAnalysis && (
                        <div className="space-y-2 mt-4 pt-4 border-t">
                          <p className="text-sm font-semibold">💡 Análise do Erro:</p>
                          <p className="text-sm whitespace-pre-wrap">{errorAnalysis}</p>
                        </div>
                      )}

                      {!isCorrect && currentHint && (
                        <div className="space-y-2 mt-4 pt-4 border-t">
                          <p className="text-sm font-semibold">💡 Dica para próxima vez:</p>
                          <p className="text-sm whitespace-pre-wrap">{currentHint}</p>
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
                  onClick={submitAnswer}
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
                  onClick={requestHint}
                  disabled={loadingHint || checking}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  {loadingHint ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando dica...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4 mr-2" />
                      {currentHint ? `Próxima Dica (${hintLevel + 2}/3)` : "Pedir Dica"}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button onClick={handleNext} className="w-full" size="lg">
                  Próxima Questão
                </Button>
                <Button onClick={handleFinish} variant="outline" className="w-full" size="lg">
                  Finalizar Sessão
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdaptiveLearning;
