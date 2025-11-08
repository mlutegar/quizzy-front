import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";
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
  adaptive_context?: {
    current_difficulty: string;
    mastered_topics: string[];
    session_question_number: number;
  };
}

const AdaptiveLearning = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
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

  useEffect(() => {
    startAdaptiveSession();
  }, []);

  const startAdaptiveSession = async () => {
    try {
      console.log("🚀 Iniciando sessão adaptativa...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("❌ Usuário não autenticado");
        toast({
          title: "Erro",
          description: "Você precisa estar logado",
          variant: "destructive",
        });
        navigate(-1);
        return;
      }

      console.log("👤 Usuário ID:", user.id);

      // Check if user has completed diagnostic for this topic
      console.log("🔍 Verificando diagnóstico no Supabase...");
      const { data: diagnosticAnswers, error: diagnosticError } = await supabase
        .from("user_answers")
        .select("*, questions!inner(topic_id)")
        .eq("user_id", user.id)
        .eq("questions.topic_id", topicId!)
        .limit(1);

      console.log("📊 Respostas diagnóstico:", diagnosticAnswers);

      let hasDiagnostic = false;
      if (diagnosticAnswers && diagnosticAnswers.length > 0) {
        hasDiagnostic = true;
        console.log("✅ Usuário já fez diagnóstico para este tópico");
        
        // Get all diagnostic answers to send to Flask
        const { data: allAnswers } = await supabase
          .from("user_answers")
          .select("*, questions!inner(topic_id, question_text, correct_answer)")
          .eq("user_id", user.id)
          .eq("questions.topic_id", topicId!);

        console.log("📋 Total de respostas:", allAnswers?.length);
      } else {
        console.log("⚠️ Nenhum diagnóstico encontrado");
      }
      
      console.log("📡 Chamando API:", `${FLASK_API_URL}/adaptive/start`);
      
      const response = await fetch(`${FLASK_API_URL}/adaptive/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: user.id,
          learning_path: "intermediate",
          has_diagnostic: hasDiagnostic,
          topic_id: topicId
        }),
      });

      console.log("📨 Resposta status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Erro na resposta:", errorText);
        throw new Error("Erro ao iniciar sessão adaptativa");
      }

      const data = await response.json();
      console.log("📦 Dados recebidos:", data);
      
      if (data.status === "ready") {
        setTopicName(data.topic_name || "Aprendizagem Adaptativa");
        toast({
          title: "Sessão Iniciada",
          description: `Vamos trabalhar: ${data.topic_name}`,
        });
        await getNextQuestion(user.id);
      } else if (data.status === "diagnostic_required") {
        console.log("⚠️ Diagnóstico necessário");
        toast({
          title: "Diagnóstico Necessário",
          description: data.message || "Complete o teste diagnóstico primeiro",
          variant: "destructive",
        });
        navigate("/diagnostic");
      } else if (data.status === "completed") {
        toast({
          title: "Parabéns!",
          description: data.message,
        });
        navigate(`/quiz/${topicId}`);
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
      console.log("🔍 Buscando próxima questão para:", userId);
      console.log("📡 URL:", `${FLASK_API_URL}/adaptive/${userId}/next`);
      
      const response = await fetch(`${FLASK_API_URL}/adaptive/${userId}/next`);
      console.log("📨 Status resposta:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Erro na resposta:", errorText);
        throw new Error("Erro ao obter questão");
      }

      const data = await response.json();
      console.log("📦 Questão recebida:", data);
      setCurrentQuestion(data);
      
      // Save question to Supabase for later practice
      if (topicId) {
        const { error } = await supabase
          .from("questions")
          .upsert({
            id: data.id,
            topic_id: topicId,
            question_text: data.problem,
            question_type: "open",
            options: null,
            correct_answer: String(data.answer),
            explanation: data.steps?.join("\n") || "",
            prerequisites: data.concepts || [],
          }, {
            onConflict: "id"
          });

        if (error) console.error("Erro ao salvar questão:", error);
      }
    } catch (error: any) {
      console.error("💥 Erro ao buscar questão:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      console.log("✅ Finalizando carregamento");
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`${FLASK_API_URL}/adaptive/${user.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          question: currentQuestion.problem,
          student_answer: userAnswer,
          correct_answer: String(currentQuestion.answer),
          solution_steps: currentQuestion.steps,
          concepts_tested: currentQuestion.concepts,
        }),
      });

      if (!response.ok) throw new Error("Erro ao submeter resposta");

      const data = await response.json();
      setIsCorrect(data.is_correct);
      setShowFeedback(true);
      setQuestionsAnswered(prev => prev + 1);

      if (data.error_analysis) {
        setErrorAnalysis(data.error_analysis.explanation || "");
      }

      // Save answer to database
      await supabase.from("user_answers").insert({
        user_id: user.id,
        question_id: currentQuestion.id,
        topic_id: topicId!,
        user_answer: userAnswer,
        is_correct: data.is_correct,
        work_shown: "",
        hints_used: 0,
      });

      if (data.status === "topic_mastered") {
        toast({
          title: "🎉 Tópico Dominado!",
          description: data.message,
        });
        setSessionComplete(true);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setShowFeedback(false);
    setUserAnswer("");
    setErrorAnalysis("");
    await getNextQuestion(user.id);
  };

  const handleFinish = () => {
    toast({
      title: "Sessão Finalizada",
      description: `Você respondeu ${questionsAnswered} questões adaptativas.`,
    });
    navigate(`/quiz/${topicId}`);
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
            <p className="text-muted-foreground mb-6">
              Você completou a sessão de aprendizagem adaptativa com sucesso!
            </p>
            <Button onClick={handleFinish} className="w-full" size="lg">
              Voltar para Questões
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

          {/* Difficulty Badge */}
          {currentQuestion?.adaptive_context && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted">
                Dificuldade: {currentQuestion.adaptive_context.current_difficulty}
              </span>
              <span className="text-xs text-muted-foreground">
                Questão #{currentQuestion.adaptive_context.session_question_number}
              </span>
            </div>
          )}
        </div>

        {/* Question Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                {currentQuestion.topic}
              </span>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-muted">
                {currentQuestion.type}
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {!showFeedback ? (
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
