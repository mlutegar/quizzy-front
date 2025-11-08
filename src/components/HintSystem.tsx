import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface HintSystemProps {
  problem: string;
  workShown: string;
  onHintUsed?: (hintLevel: number) => void;
  className?: string;
}

export const HintSystem = ({ problem, workShown, onHintUsed, className }: HintSystemProps) => {
  const [hints, setHints] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const generateHint = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-hint', {
        body: { problem, workShown }
      });

      if (error) throw error;

      if (data?.hint) {
        setHints(prev => [...prev, data.hint]);
        onHintUsed?.(hints.length + 1);
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
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {getHintLabel(index)}
                  </p>
                  <p className="text-sm text-foreground">{hint}</p>
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
