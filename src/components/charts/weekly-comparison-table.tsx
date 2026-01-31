'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowUp, ArrowDown, Minus, Trophy } from 'lucide-react'

interface Metric {
    id: string
    nps_score: number
    promoters_count: number
    detractors_count: number
    goal_2026_1: number
    responses_count: number
    position_ranking: number
    week_start_date: string
    units: {
        name: string
        code: string
    }
}

interface WeeklyComparisonTableProps {
    currentMetrics: Metric[]
    previousMetrics: Metric[]
}

export function WeeklyComparisonTable({ currentMetrics, previousMetrics }: WeeklyComparisonTableProps) {
    // Create a map of previous metrics by unit code
    const previousMap = new Map(
        previousMetrics.map(m => [m.units?.code, m])
    )

    // Sort by current ranking
    const sortedMetrics = [...currentMetrics].sort((a, b) => a.position_ranking - b.position_ranking)

    const getVariation = (current: Metric) => {
        const previous = previousMap.get(current.units?.code)
        if (!previous) return null
        return previous.position_ranking - current.position_ranking
    }

    const getVariationIcon = (variation: number | null) => {
        if (variation === null) return <Minus className="h-4 w-4 text-muted-foreground" />
        if (variation > 0) return <ArrowUp className="h-4 w-4 text-green-600" />
        if (variation < 0) return <ArrowDown className="h-4 w-4 text-red-600" />
        return <Minus className="h-4 w-4 text-muted-foreground" />
    }

    const getVariationBadge = (variation: number | null) => {
        if (variation === null) return <Badge variant="outline">Novo</Badge>
        if (variation > 0) return <Badge className="bg-green-100 text-green-800">+{variation}</Badge>
        if (variation < 0) return <Badge className="bg-red-100 text-red-800">{variation}</Badge>
        return <Badge variant="outline">=</Badge>
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Ranking de Unidades
                </CardTitle>
                <CardDescription>
                    Comparativo semanal de desempenho NPS
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[60px]">Pos.</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead className="text-center">Var.</TableHead>
                            <TableHead className="text-right">Resp.</TableHead>
                            <TableHead className="text-right">NPS</TableHead>
                            <TableHead className="text-right">Meta</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedMetrics.map((metric) => {
                            const variation = getVariation(metric)

                            return (
                                <TableRow key={metric.id}>
                                    <TableCell className="font-bold">
                                        #{metric.position_ranking}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{metric.units?.name}</span>
                                            <span className="text-xs text-muted-foreground">{metric.units?.code}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {getVariationIcon(variation)}
                                            {getVariationBadge(variation)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">{metric.responses_count}</TableCell>
                                    <TableCell className="text-right font-bold text-lg">
                                        {metric.nps_score?.toFixed(1)}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {metric.goal_2026_1?.toFixed(1)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge
                                            className={`
                                                    font-black uppercase text-[8px] tracking-widest px-3 py-1 rounded-full border-none
                                                    ${metric.nps_score >= (metric.goal_2026_1 || 75)
                                                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                                                    : (metric.goal_2026_1 || 75) - metric.nps_score <= 5
                                                        ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
                                                        : 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                                }
                                                `}
                                        >
                                            {metric.nps_score >= (metric.goal_2026_1 || 75)
                                                ? "Na Meta"
                                                : (metric.goal_2026_1 || 75) - metric.nps_score <= 5
                                                    ? "Atenção"
                                                    : "Abaixo"}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {sortedMetrics.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                    Nenhum dado. Faça upload do CSV.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
