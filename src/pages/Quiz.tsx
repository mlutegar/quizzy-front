import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { QuestionIndicators } from "@/components/QuestionIndicators";
import { HintSystem } from "@/components/HintSystem";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  question_text: string;
  question_type: "multiple_choice" | "open";
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  prerequisites: string[];
}

interface QuizProps {
  addMessageToChat?: (role: "user" | "assistant", content: string) => void;
  setSessionId?: (sessionId: string) => void;
}

const Quiz = ({ addMessageToChat, setSessionId }: QuizProps) => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(boolean | null)[]>([null, null, null, null, null]);
  const [userAnswer, setUserAnswer] = useState("");
  const [workShown, setWorkShown] = useState("");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [aiFeedback, setAiFeedback] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  
  // Adaptive Learning States
  const [isAdaptiveMode, setIsAdaptiveMode] = useState(false);
  const [adaptiveQuestion, setAdaptiveQuestion] = useState<any>(null);
  const [adaptiveLoading, setAdaptiveLoading] = useState(false);

  const currentQuestion = questions[currentIndex];
  const correctCount = answers.filter(a => a === true).length;
  const remainingToMaster = 5 - correctCount;

  useEffect(() => {
    if (topicId) {
      loadQuestions();
    }
  }, [topicId]);

  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("topic_id", topicId)
        .limit(5);

      if (error) throw error;
      if (!data || data.length === 0) {
        toast({
          title: "Nenhuma questão disponível",
          description: "Este tópico ainda não possui questões cadastradas.",
          variant: "destructive",
        });
        navigate(-1);
        return;
      }

      setQuestions(data as Question[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar questões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAnswer = async () => {
    if (!userAnswer.trim()) {
      toast({
        title: "Resposta vazia",
        description: "Por favor, responda à questão antes de verificar.",
        variant: "destructive",
      });
      return;
    }

    // Enviar para o chat
    addMessageToChat?.("user", `Verificar resposta: ${userAnswer}`);

    setChecking(true);
    const correct = userAnswer.trim().toLowerCase() === currentQuestion.correct_answer.toLowerCase();
    setIsCorrect(correct);

    // Save answer
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_answers").insert({
        user_id: user.id,
        question_id: currentQuestion.id,
        topic_id: topicId!,
        user_answer: userAnswer,
        is_correct: correct,
        work_shown: workShown,
        hints_used: hintsUsed,
      });
    }

    // Update answers array
    const newAnswers = [...answers];
    newAnswers[currentIndex] = correct;
    setAnswers(newAnswers);

    // If incorrect, get AI feedback
    if (!correct) {
      setAiLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("analyze-error", {
          body: {
            question: currentQuestion.question_text,
            studentAnswer: userAnswer,
            correctAnswer: currentQuestion.correct_answer,
            workShown: workShown,
            prerequisites: currentQuestion.prerequisites,
          },
        });

        if (error) throw error;
        setAiFeedback(data.feedback);
        addMessageToChat?.("assistant", data.feedback);
      } catch (error: any) {
        console.error("Error getting AI feedback:", error);
        setAiFeedback("Não consegui analisar seu erro no momento. Tente novamente mais tarde.");
      } finally {
        setAiLoading(false);
      }
    }

    setShowFeedback(true);
    setChecking(false);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer("");
      setWorkShown("");
      setHintsUsed(0);
      setShowFeedback(false);
      setAiFeedback("");
      setIsAdaptiveMode(false);
      setAdaptiveQuestion(null);
    } else {
      // Quiz completed
      const finalCorrect = answers.filter(a => a === true).length;
      if (finalCorrect === 5) {
        toast({
          title: "🎉 Parabéns! Tópico Dominado!",
          description: "Você acertou 5 questões consecutivas!",
        });
      }
      navigate(-1);
    }
  };

  const FLASK_API_URL = "http://localhost:5000";

  const startAdaptiveSession = async () => {
    setAdaptiveLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`${FLASK_API_URL}/adaptive/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: user.id,
          learning_path: "intermediate"
        }),
      });

      if (!response.ok) throw new Error("Erro ao iniciar sessão adaptativa");

      const data = await response.json();
      
      if (data.status === "ready") {
        toast({
          title: "Sessão Adaptativa Iniciada",
          description: `Vamos trabalhar: ${data.topic_name}`,
        });
        await getAdaptiveQuestion();
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAdaptiveLoading(false);
    }
  };

  const getAdaptiveQuestion = async () => {
    setAdaptiveLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`${FLASK_API_URL}/adaptive/${user.id}/next`);
      if (!response.ok) throw new Error("Erro ao obter questão");

      const data = await response.json();
      setAdaptiveQuestion(data);
      setIsAdaptiveMode(true);
      setUserAnswer("");
      setWorkShown("");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAdaptiveLoading(false);
    }
  };

  const submitAdaptiveAnswer = async () => {
    if (!userAnswer.trim() || !adaptiveQuestion) return;

    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`${FLASK_API_URL}/adaptive/${user.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: adaptiveQuestion.id,
          question: adaptiveQuestion.problem,
          student_answer: userAnswer,
          correct_answer: adaptiveQuestion.answer,
          solution_steps: adaptiveQuestion.steps,
          concepts_tested: adaptiveQuestion.concepts,
        }),
      });

      if (!response.ok) throw new Error("Erro ao submeter resposta");

      const data = await response.json();
      setIsCorrect(data.is_correct);
      setShowFeedback(true);

      if (data.error_analysis) {
        setAiFeedback(data.error_analysis.explanation);
      }

      if (data.status === "topic_mastered") {
        toast({
          title: "🎉 Tópico Dominado!",
          description: data.message,
        });
        setTimeout(() => {
          setIsAdaptiveMode(false);
          setAdaptiveQuestion(null);
          setShowFeedback(false);
        }, 3000);
      } else if (data.status === "prerequisite_required") {
        toast({
          title: "Pré-requisito necessário",
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

  const handleNextAdaptive = async () => {
    setShowFeedback(false);
    await getAdaptiveQuestion();
  };

  const exitAdaptiveMode = () => {
    setIsAdaptiveMode(false);
    setAdaptiveQuestion(null);
    setShowFeedback(false);
    setUserAnswer("");
    setWorkShown("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Gerando questões...</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-success/10">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>

          {/* Progress */}
          <div className="bg-card rounded-lg p-4 shadow-sm mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Questão {currentIndex + 1} de {questions.length}
              </h2>
              <div className="text-sm">
                <span className="text-success font-semibold">✓ {correctCount}</span>
                <span className="text-muted-foreground mx-2">|</span>
                <span className="text-muted-foreground">
                  Faltam {remainingToMaster} para dominar
                </span>
              </div>
            </div>
            <QuestionIndicators
              total={5}
              current={currentIndex}
              answers={answers}
            />
          </div>
        </div>

        {/* Question Card */}
        <Card className="mb-6">
          <CardHeader>
            {isAdaptiveMode && (
              <div className="mb-4 bg-primary/10 text-primary px-4 py-2 rounded-md text-sm font-medium">
                🧠 Modo de Aprendizagem Adaptativa
              </div>
            )}
            <CardTitle className="text-xl leading-relaxed">
              {isAdaptiveMode && adaptiveQuestion
                ? adaptiveQuestion.problem
                : currentQuestion.question_text}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Answer Input */}
            {!isAdaptiveMode && currentQuestion.question_type === "multiple_choice" && currentQuestion.options ? (
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

            {/* Work Area */}
            <div className="space-y-2">
              <Label>Desenvolvimento / Cálculos (opcional)</Label>
              <Textarea
                value={workShown}
                onChange={(e) => setWorkShown(e.target.value)}
                placeholder="Mostre seu raciocínio..."
                className="min-h-[100px]"
                disabled={showFeedback}
              />
            </div>

            {/* Hint System - Only in regular mode */}
            {!showFeedback && !isAdaptiveMode && (
              <HintSystem
                problem={currentQuestion.question_text}
                workShown={workShown}
                onHintUsed={(level) => setHintsUsed(level)}
                onHintGenerated={(hint) => {
                  addMessageToChat?.("user", "Preciso de uma dica");
                  addMessageToChat?.("assistant", hint);
                }}
                onResponseSubmitted={(response) => {
                  addMessageToChat?.("user", response);
                }}
                onSessionIdReceived={(id) => {
                  setSessionId?.(id);
                }}
              />
            )}

            {/* Feedback */}
            {showFeedback && (
              <Card className={cn(
                "border-l-4",
                isCorrect ? "border-l-success bg-success-light" : "border-l-error bg-error-light"
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 mb-4">
                    {isCorrect ? (
                      <CheckCircle className="w-6 h-6 text-success flex-shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-error flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">
                        {isCorrect ? "Resposta Correta! 🎉" : "Resposta Incorreta"}
                      </h3>
                      
                      {!isAdaptiveMode && (
                        <p className="text-sm mb-3">{currentQuestion.explanation}</p>
                      )}

                      {isAdaptiveMode && adaptiveQuestion && (
                        <div className="space-y-2 mb-3">
                          <p className="text-sm font-semibold">✓ Resposta correta: {adaptiveQuestion.answer}</p>
                          <div className="text-sm">
                            <p className="font-semibold mb-1">📝 Passos da solução:</p>
                            <ol className="list-decimal list-inside space-y-1">
                              {adaptiveQuestion.steps.map((step: string, idx: number) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      )}
                      
                      {!isCorrect && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">💡 Análise do Erro:</p>
                          {aiLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm">Analisando seu erro...</span>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{aiFeedback}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Adaptive Learning Button - Only show when not in adaptive mode and answer is incorrect */}
                  {!isCorrect && !isAdaptiveMode && !adaptiveLoading && (
                    <Button
                      onClick={startAdaptiveSession}
                      variant="outline"
                      className="w-full mt-4"
                    >
                      🧠 Gerar Questões Adaptativas
                    </Button>
                  )}

                  {adaptiveLoading && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Preparando questões adaptativas...</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {!showFeedback ? (
              <Button
                onClick={isAdaptiveMode ? submitAdaptiveAnswer : handleCheckAnswer}
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
              <div className="space-y-2">
                {isAdaptiveMode ? (
                  <>
                    <Button onClick={handleNextAdaptive} className="w-full" size="lg">
                      Próxima Questão Adaptativa
                    </Button>
                    <Button onClick={exitAdaptiveMode} variant="outline" className="w-full" size="lg">
                      Voltar para Questões Normais
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleNext} className="w-full" size="lg">
                    {currentIndex < questions.length - 1 ? "Próxima Questão" : "Finalizar"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Quiz;
