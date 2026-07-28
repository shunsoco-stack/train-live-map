import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ServiceStatus } from "@/types/train";

interface ServiceStatusBarProps {
  serviceStatus: ServiceStatus | null;
}

const SEVERITY_STYLE: Record<
  ServiceStatus["severity"],
  { border: string; accent: string; icon: typeof Info }
> = {
  normal: {
    border: "border-emerald-500/60",
    accent: "text-emerald-300",
    icon: CheckCircle2,
  },
  minor: {
    border: "border-amber-500/60",
    accent: "text-amber-300",
    icon: AlertTriangle,
  },
  major: {
    border: "border-red-500/70",
    accent: "text-red-300",
    icon: AlertTriangle,
  },
};

/**
 * 路線の運行情報を簡潔に表示するバー。
 * 明るい地図の上でも読めるよう、不透明なダークカード + 重要度色のアクセントで表示する。
 */
export function ServiceStatusBar({ serviceStatus }: ServiceStatusBarProps) {
  if (!serviceStatus) return null;
  const style = SEVERITY_STYLE[serviceStatus.severity];
  const Icon = style.icon;
  const normal = serviceStatus.severity === "normal";

  return (
    <div
      role="status"
      className={`app-material pointer-events-auto flex max-w-full items-start gap-2 border px-3 py-2 text-xs font-medium text-rail-text ${
        normal ? "self-start rounded-full" : "w-full rounded-xl"
      } ${style.border}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.accent}`} aria-hidden />
      <p className="leading-snug">
        <span className={`font-semibold ${style.accent}`}>{serviceStatus.lineName}</span>
        <span className="mx-1 text-rail-muted" aria-hidden>
          ｜
        </span>
        {serviceStatus.message}
      </p>
    </div>
  );
}
