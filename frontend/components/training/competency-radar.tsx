"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RADAR_COMPETENCY_LABELS } from "@/lib/labels";
import type { RadarScores } from "@/types/training";
import { cn } from "@/lib/utils";

const AXES = [
  "needs_discovery",
  "solution_presentation",
  "objection_handling",
  "closing_persistence",
  "technical_expertise",
  "risk_management",
] as const;

const ZERO_SCORES: RadarScores = {
  needs_discovery: 0,
  solution_presentation: 0,
  objection_handling: 0,
  closing_persistence: 0,
  technical_expertise: 0,
  risk_management: 0,
};

interface CompetencyRadarProps {
  data?: RadarScores | null;
  isLoading?: boolean;
  title?: string;
  description?: string;
  /** Manager's own messages in the dialogue */
  managerReplies?: number;
  /** Times Terra hint was requested */
  hintRequests?: number;
}

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { fullLabel?: string; value?: number } }>;
}): React.JSX.Element | null {
  if (!active || !payload?.length) {
    return null;
  }
  const item = payload[0]?.payload;
  if (!item) {
    return null;
  }
  return (
    <div className="rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 text-xs text-slate-100 shadow-glow-accent backdrop-blur-md">
      {item.fullLabel}: {item.value}%
    </div>
  );
}

export function CompetencyRadar({
  data,
  isLoading,
  title = "Компетенции",
  description = "Динамика по репликам менеджера",
  managerReplies,
  hintRequests,
}: CompetencyRadarProps): React.JSX.Element {
  const scores = data ?? ZERO_SCORES;
  const chartData = AXES.map((key) => ({
    key,
    label: RADAR_COMPETENCY_LABELS[key] ?? key,
    fullLabel: RADAR_COMPETENCY_LABELS[key] ?? key,
    value: Math.max(0, Math.min(100, Number(scores[key] ?? 0))),
  }));
  const showCounters = managerReplies != null || hintRequests != null;
  const replies = managerReplies ?? 0;
  const hints = hintRequests ?? 0;

  return (
    <Card className={cn("shrink-0", isLoading && "animate-pulse")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {isLoading ? (
            "Обновляем радар…"
          ) : showCounters ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{description}</span>
              <span className="text-slate-300">·</span>
              <span>
                сам:{" "}
                <span className="font-semibold tabular-nums text-accent">{replies}</span>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                подсказок:{" "}
                <span className="font-semibold tabular-nums text-accent">{hints}</span>
              </span>
            </span>
          ) : (
            description
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis
                dataKey="label"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Tooltip content={<RadarTooltip />} />
              <Radar
                name="Компетенции"
                dataKey="value"
                stroke="#F97316"
                fill="#F97316"
                fillOpacity={0.18}
                strokeWidth={2}
                isAnimationActive
                animationDuration={400}
                animationEasing="ease-in-out"
                dot={{ r: 3, fill: "#F97316", stroke: "#F97316" }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400">
          {chartData.map((item) => (
            <li key={item.key} className="flex justify-between gap-2">
              <span>{item.label}</span>
              <span className="font-medium text-slate-100">{item.value}%</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export { ZERO_SCORES };
