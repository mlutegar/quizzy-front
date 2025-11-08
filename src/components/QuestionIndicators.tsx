import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface QuestionIndicatorsProps {
  total: number;
  current: number;
  answers: (boolean | null)[];
  className?: string;
}

export const QuestionIndicators = ({
  total,
  current,
  answers,
  className,
}: QuestionIndicatorsProps) => {
  return (
    <div className={cn("flex items-center gap-2 justify-center", className)}>
      {Array.from({ length: total }).map((_, index) => {
        const isCurrent = index === current;
        const answer = answers[index];
        
        return (
          <div
            key={index}
            className={cn(
              "relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
              isCurrent && "ring-2 ring-primary ring-offset-2",
              answer === true && "bg-success",
              answer === false && "bg-error",
              answer === null && !isCurrent && "bg-muted",
              answer === null && isCurrent && "bg-primary"
            )}
          >
            {answer === true && <Check className="w-5 h-5 text-white" />}
            {answer === false && <X className="w-5 h-5 text-white" />}
            {answer === null && (
              <span className={cn(
                "text-sm font-semibold",
                isCurrent ? "text-white" : "text-muted-foreground"
              )}>
                {index + 1}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
