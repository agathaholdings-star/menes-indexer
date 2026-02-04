"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";

interface CompositionChartProps {
  types: { type: string; percentage: number }[];
}

const COLORS = ["#E11D48", "#FB7185", "#FDA4AF", "#FECDD3", "#FFF1F2"];

export function CompositionChart({ types }: CompositionChartProps) {
  const data = types.map((t) => ({
    name: t.type,
    value: t.percentage,
  }));

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0">
        <CardTitle className="text-base font-semibold">成分分析</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex items-center gap-4">
          <ChartContainer
            config={{
              value: {
                label: "割合",
                color: COLORS[0],
              },
            }}
            className="h-[140px] w-[140px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${
                        // biome-ignore lint/suspicious/noArrayIndexKey: index is stable
                        index
                      }`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="flex flex-col gap-2">
            {types.map((t, index) => (
              <div key={t.type} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-foreground">
                  {t.type} <span className="font-semibold">{t.percentage}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
