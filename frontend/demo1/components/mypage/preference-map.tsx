"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { therapistTypes, bodyTypes, serviceTypes } from "@/lib/data";
import { PenSquare } from "lucide-react";

const COLORS = ["#E11D48", "#FB7185", "#FDA4AF", "#FECDD3", "#FFF1F2", "#F59E0B", "#34D399", "#60A5FA"];

interface PreferenceData {
  totalReviews: number;
  looksTypes: { id: string; count: number; percentage: number }[];
  bodyTypes: { id: string; count: number; percentage: number }[];
  serviceTypes: { id: string; count: number; percentage: number }[];
  avgParameters: {
    conversation: number;
    distance: number;
    technique: number;
    personality: number;
  };
}

export function PreferenceMap({ data }: { data: PreferenceData }) {
  if (data.totalReviews === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <PenSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">口コミを投稿すると嗜好マップが表示されます</p>
          <p className="text-sm text-muted-foreground">投稿するほど精度がアップします</p>
        </CardContent>
      </Card>
    );
  }

  const looksData = data.looksTypes
    .map((t) => ({
      name: therapistTypes.find((tt) => tt.id === t.id)?.label || t.id,
      value: t.percentage,
    }))
    .sort((a, b) => b.value - a.value);

  const bodyData = data.bodyTypes
    .map((t) => ({
      name: bodyTypes.find((bt) => bt.id === t.id)?.label || t.id,
      value: t.percentage,
    }))
    .sort((a, b) => b.value - a.value);

  const radarData = [
    { subject: "会話", value: data.avgParameters.conversation, fullMark: 5 },
    { subject: "距離感", value: data.avgParameters.distance, fullMark: 5 },
    { subject: "技術", value: data.avgParameters.technique, fullMark: 5 },
    { subject: "性格", value: data.avgParameters.personality, fullMark: 5 },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            嗜好マップ
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {data.totalReviews}件の投稿から分析
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-6">
          {/* タイプ分布 */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">好みのタイプ</p>
            <div className="flex items-center gap-4">
              <ChartContainer
                config={{ value: { label: "割合", color: COLORS[0] } }}
                className="h-[120px] w-[120px] flex-shrink-0"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={looksData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {looksData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="flex flex-col gap-1.5">
                {looksData.map((t, i) => (
                  <div key={t.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs">{t.name} <span className="font-semibold">{t.value}%</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 体型分布 */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">好みの体型</p>
            <div className="flex items-center gap-4">
              <ChartContainer
                config={{ value: { label: "割合", color: COLORS[0] } }}
                className="h-[120px] w-[120px] flex-shrink-0"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bodyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {bodyData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="flex flex-col gap-1.5">
                {bodyData.map((t, i) => (
                  <div key={t.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs">{t.name} <span className="font-semibold">{t.value}%</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* パラメータ傾向 */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">好みの傾向</p>
          <ChartContainer
            config={{ value: { label: "平均", color: "#E11D48" } }}
            className="h-[200px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#e5e5e5" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#525252", fontSize: 12 }} />
                <Radar
                  name="あなたの傾向"
                  dataKey="value"
                  stroke="#E11D48"
                  fill="#E11D48"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* サービス傾向 */}
        {data.serviceTypes.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">サービスタイプ</p>
            <div className="flex gap-3">
              {data.serviceTypes
                .sort((a, b) => b.count - a.count)
                .map((st) => {
                  const label = serviceTypes.find((s) => s.id === st.id)?.label || st.id;
                  return (
                    <div key={st.id} className="flex-1 text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold text-primary">{st.percentage}%</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          投稿するほど精度がアップします
        </p>
      </CardContent>
    </Card>
  );
}
