'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp } from 'lucide-react'

interface Metric {
    id: string
    nps_score: number
    week_start_date: string
    units: {
        name: string
        code: string
    }
}

interface NpsEvolutionChartProps {
    metrics: Metric[]
}

// Color palette for units
const COLORS = [
    '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
    '#0891b2', '#c026d3', '#ea580c', '#4f46e5', '#059669'
]

export function NpsEvolutionChart({ metrics }: NpsEvolutionChartProps) {
    // Group metrics by week and unit
    const weeklyData: Record<string, any> = {}
    const unitNames = new Set<string>()

    metrics.forEach(m => {
        const week = m.week_start_date
        const unitName = m.units?.name || 'Unknown'

        unitNames.add(unitName)

        if (!weeklyData[week]) {
            weeklyData[week] = { week }
        }
        weeklyData[week][unitName] = m.nps_score
    })

    // Convert to array and sort by date
    const chartData = Object.values(weeklyData)
        .sort((a: any, b: any) => new Date(a.week).getTime() - new Date(b.week).getTime())
        .map((item: any) => ({
            ...item,
            week: new Date(item.week).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        }))

    const unitNameArray = Array.from(unitNames)

    if (chartData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        Evolução NPS
                    </CardTitle>
                    <CardDescription>
                        Gráfico de evolução ao longo das semanas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Faça upload de CSVs de múltiplas semanas para ver a evolução.
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Evolução NPS
                </CardTitle>
                <CardDescription>
                    Evolução do NPS por unidade ao longo das semanas
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="week"
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                        />
                        <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: 'var(--radius)'
                            }}
                        />
                        <Legend />
                        {unitNameArray.map((unitName, index) => (
                            <Line
                                key={unitName}
                                type="monotone"
                                dataKey={unitName}
                                stroke={COLORS[index % COLORS.length]}
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
