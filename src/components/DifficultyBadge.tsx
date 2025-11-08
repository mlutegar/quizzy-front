import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DifficultyBadgeProps {
  percentage: number;
  className?: string;
}

export const DifficultyBadge = ({ percentage, className }: DifficultyBadgeProps) => {
  const getVariant = () => {
    if (percentage >= 76) return "success";
    if (percentage >= 51) return "warning";
    if (percentage >= 26) return "default";
    return "secondary";
  };

  const getIcon = () => {
    if (percentage >= 76) return "🟢";
    if (percentage >= 51) return "🟠";
    if (percentage >= 26) return "🟡";
    return "🔴";
  };

  const getLabel = () => {
    if (percentage >= 76) return "Dominado";
    if (percentage >= 51) return "Competente";
    if (percentage >= 26) return "Aprendendo";
    return "Iniciante";
  };

  return (
    <Badge
      variant={getVariant() as any}
      className={cn("gap-1.5 px-3 py-1", className)}
    >
      <span>{getIcon()}</span>
      <span>{getLabel()}</span>
    </Badge>
  );
};
