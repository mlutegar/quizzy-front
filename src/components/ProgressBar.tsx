import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  showLabel?: boolean;
}

export const ProgressBar = ({ value, className, showLabel = true }: ProgressBarProps) => {
  const getLabel = () => {
    if (value >= 76) return "Dominado";
    if (value >= 51) return "Competente";
    if (value >= 26) return "Aprendendo";
    return "Iniciante";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Progress value={value} className="h-2" />
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{getLabel()}</span>
          <span className="font-semibold text-foreground">{value}%</span>
        </div>
      )}
    </div>
  );
};
