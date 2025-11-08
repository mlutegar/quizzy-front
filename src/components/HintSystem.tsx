import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface HintSystemProps {
  hints: string[];
  onHintUsed: (hintLevel: number) => void;
  className?: string;
}

export const HintSystem = ({ hints, onHintUsed, className }: HintSystemProps) => {
  const [currentHintLevel, setCurrentHintLevel] = useState(0);

  const showNextHint = () => {
    if (currentHintLevel < hints.length) {
      setCurrentHintLevel(currentHintLevel + 1);
      onHintUsed(currentHintLevel + 1);
    }
  };

  const getHintLabel = (level: number) => {
    if (level === 1) return "Dica Leve";
    if (level === 2) return "Dica Média";
    return "Dica Completa";
  };

  return (
    <div className={cn("space-y-3", className)}>
      {currentHintLevel === 0 ? (
        <Button
          variant="outline"
          onClick={showNextHint}
          className="w-full gap-2"
        >
          <Lightbulb className="w-4 h-4" />
          Preciso de uma dica
        </Button>
      ) : (
        <div className="space-y-3">
          {hints.slice(0, currentHintLevel).map((hint, index) => (
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
                    {getHintLabel(index + 1)}
                  </p>
                  <p className="text-sm text-foreground">{hint}</p>
                </div>
              </div>
            </Card>
          ))}
          
          {currentHintLevel < hints.length && (
            <Button
              variant="outline"
              onClick={showNextHint}
              size="sm"
              className="w-full gap-2"
            >
              <Lightbulb className="w-4 h-4" />
              Ver próxima dica
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
