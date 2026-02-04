"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";

interface ParameterRadarChartProps {
  parameters: {
    conversation: number;
    distance: number;
    technique: number;
    personality: number;
  };
}

export function ParameterRadarChart({ parameters }: ParameterRadarChartProps) {
  const data = [
    { subject: "会話", value: parameters.conversation, fullMark: 5 },
    { subject: "距離感", value: parameters.distance, fullMark: 5 },
    { subject: "技術", value: parameters.technique, fullMark: 5 },
    { subject: "性格", value: parameters.personality, fullMark: 5 },
  ];

  const primaryColor = "#E11D48";

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0">
        <CardTitle className="text-base font-semibold">
          パラメータ分析
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ChartContainer
          config={{
            value: {
              label: "評価",
              color: primaryColor,
            },
          }}
          className="h-[220px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
              <PolarGrid stroke="#e5e5e5" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#525252", fontSize: 12 }}
              />
              <Radar
                name="評価"
                dataKey="value"
                stroke={primaryColor}
                fill={primaryColor}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
