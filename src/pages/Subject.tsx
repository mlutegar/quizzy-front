import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ProgressBar";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Topic {
  id: string;
  name: string;
  description: string;
  icon: string;
  order_index: number;
}

interface UserProgress {
  topic_id: string;
  mastery_percentage: number;
  consecutive_correct: number;
  total_attempts: number;
}

interface DiagnosticResult {
  topic_id: string;
  total_questions: number;
  correct_answers: number;
  accuracy_percentage: number;
  completed_at: string;
}

const Subject = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  const [diagnostics, setDiagnostics] = useState<Record<string, DiagnosticResult>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopicsAndProgress();
  }, []);

  const loadTopicsAndProgress = async () => {
    try {
      const { data: topicsData, error: topicsError } = await supabase
        .from("topics")
        .select("*")
        .eq("subject", "Matemática")
        .order("order_index", { ascending: true });

      if (topicsError) throw topicsError;

      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Load progress
        const { data: progressData, error: progressError } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", user.id);

        if (progressError) throw progressError;

        const progressMap = progressData.reduce((acc, item) => {
          acc[item.topic_id] = item;
          return acc;
        }, {} as Record<string, UserProgress>);

        setProgress(progressMap);
      }

      setTopics(topicsData || []);
    } catch (error: any) {
      console.error("❌ Erro:", error);
      toast({
        title: "Erro ao carregar tópicos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = (topicId: string) => {
    navigate(`/quiz/${topicId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando tópicos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-success/10">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Matemática</h1>
          <p className="text-muted-foreground">
            Escolha um tópico para gerar um simulado personalizado. Acerte 5 questões consecutivas para dominar!
          </p>
        </div>

        {/* Topics List */}
        <div className="space-y-4">
          {topics.map((topic) => {
            const topicProgress = progress[topic.id];
            const masteryPercentage = topicProgress?.mastery_percentage || 0;
            const consecutiveCorrect = topicProgress?.consecutive_correct || 0;

            return (
              <Card
                key={topic.id}
                className="hover:shadow-lg transition-all duration-300"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{topic.icon}</span>
                        <div className="flex-1">
                          <CardTitle className="text-xl">{topic.name}</CardTitle>
                          <CardDescription>{topic.description}</CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-4">
                        <DifficultyBadge percentage={masteryPercentage} />
                        {consecutiveCorrect > 0 && (
                          <span className="text-sm text-muted-foreground">
                            🔥 {consecutiveCorrect} acerto(s) seguido(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <ProgressBar value={masteryPercentage} />
                    <Button
                      onClick={() => handleStartQuiz(topic.id)}
                      className="w-full gap-2"
                      size="lg"
                    >
                      <Play className="w-4 h-4" />
                      Gerar Simulado (10 questões)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Subject;
