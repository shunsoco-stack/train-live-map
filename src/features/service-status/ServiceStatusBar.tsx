import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ServiceStatus } from "@/types/train";

interface ServiceStatusBarProps {
  serviceStatus: ServiceStatus | null;
}

const SEVERITY_STYLE: Record<
  ServiceStatus["severity"],
  { bg: string; text: string; icon: typeof Info }
> = {
  normal: {
    bg: "bg-emerald-500/10 border-emerald-500/40",
    text: "text-emerald-200",
    icon: CheckCircle2,
  },
  minor: {
    bg: "bg-amber-500/10 border-amber-500/40",
    text: "text-amber-200",
    icon: AlertTriangle,
  },
  major: {
    bg: "bg-red-500/15 border-red-500/50",
    text: "text-red-200",
    icon: AlertTriangle,
  },
};

/** 路線の運行情報を簡潔に表示するバー。 */
export function ServiceStatusBar({ serviceStatus }: ServiceStatusBarProps) {
  if (!serviceStatus) return null;
  const style = SEVERITY_STYLE[serviceStatus.severity];
  const Icon = style.icon;

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-xs backdrop-blur ${style.bg} ${style.text}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="leading-snug">
        <span className="font-semibold">{serviceStatus.lineName}</span>
        <span className="mx-1" aria-hidden>
          ｜
        </span>
        {serviceStatus.message}
      </p>
    </div>
  );
}
