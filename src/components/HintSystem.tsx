import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lightbulb, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const FLASK_API_URL = "http://localhost:5000";

interface HintData {
  question: string;
  session_id: string;
  hint_level: number;
  phase: string;
}

interface HintSystemProps {
  problem: string;
  workShown: string;
  onHintUsed?: (hintLevel: number) => void;
  onHintGenerated?: (hint: string) => void;
  onResponseSubmitted?: (response: string) => void;
  className?: string;
}

export const HintSystem = ({ problem, workShown, onHintUsed, onHintGenerated, onResponseSubmitted, className }: HintSystemProps) => {
  const [hints, setHints] = useState<HintData[]>([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const { toast } = useToast();

  const generateHint = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${FLASK_API_URL}/start`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          problem: `${problem}, com o desenvolvimento até então: ${workShown || 'nenhum'}`
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao gerar dica: ${response.status}`);
      }

      const data = await response.json();

      if (data?.question) {
        setHints(prev => [...prev, data]);
        onHintUsed?.(hints.length + 1);
        onHintGenerated?.(data.question);
      }
    } catch (error: any) {
      console.error('Error generating hint:', error);
      toast({
        title: "Erro ao gerar dica",
        description: error.message || "Tente novamente em alguns instantes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const submitResponse = async (hintIndex: number) => {
    if (!currentResponse.trim()) return;

    setIsSubmittingResponse(true);
    try {
      const hint = hints[hintIndex];
      
      // Send user response to chat
      onResponseSubmitted?.(currentResponse);
      
      const response = await fetch(`${FLASK_API_URL}/start`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response: currentResponse,
          session_id: hint.session_id
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar resposta: ${response.status}`);
      }

      const data = await response.json();

      // Add the new hint from the response
      if (data?.question) {
        setHints(prev => [...prev, data]);
        onHintGenerated?.(data.question);
      }

      setCurrentResponse("");
      toast({
        title: "Resposta enviada!",
        description: "O professor está analisando sua resposta...",
      });
    } catch (error: any) {
      console.error('Error submitting response:', error);
      toast({
        title: "Erro ao enviar resposta",
        description: error.message || "Tente novamente em alguns instantes",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const getHintLabel = (index: number) => {
    if (index === 0) return "Dica Leve";
    if (index === 1) return "Dica Média";
    return "Dica Completa";
  };

  return (
    <div className={cn("space-y-3", className)}>
      {hints.length === 0 ? (
        <Button
          variant="outline"
          onClick={generateHint}
          className="w-full gap-2"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gerando dica...
            </>
          ) : (
            <>
              <Lightbulb className="w-4 h-4" />
              Preciso de uma dica
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-3">
          {hints.map((hint, index) => (
            <Card
              key={index}
              className={cn(
                "p-4 border-l-4 transition-all duration-300",
                index === 0 && "border-l-primary bg-accent",
                index === 1 && "border-l-warning bg-warning-light",
                index === 2 && "border-l-success bg-success-light"
              )}
            >
              <div className="flex items-start gap-3">
                <Lightbulb className={cn(
                  "w-5 h-5 flex-shrink-0 mt-0.5",
                  index === 0 && "text-primary",
                  index === 1 && "text-warning",
                  index === 2 && "text-success"
                )} />
                <div className="space-y-3 flex-1">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {getHintLabel(index)}
                    </p>
                    <p className="text-sm text-foreground">{hint.question}</p>
                  </div>
                  
                  {/* Response input for the last hint */}
                  {index === hints.length - 1 && (
                    <div className="flex gap-2">
                      <Input
                        value={currentResponse}
                        onChange={(e) => setCurrentResponse(e.target.value)}
                        placeholder="Digite sua resposta..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isSubmittingResponse) {
                            submitResponse(index);
                          }
                        }}
                        disabled={isSubmittingResponse}
                      />
                      <Button
                        size="icon"
                        onClick={() => submitResponse(index)}
                        disabled={isSubmittingResponse || !currentResponse.trim()}
                      >
                        {isSubmittingResponse ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
          
          <Button
            variant="outline"
            onClick={generateHint}
            size="sm"
            className="w-full gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando dica...
              </>
            ) : (
              <>
                <Lightbulb className="w-4 h-4" />
                Ver próxima dica
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
