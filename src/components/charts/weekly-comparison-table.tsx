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
        if (!previous) return { ranking: null, nps: null, responses: null }
        return {
            ranking: previous.position_ranking - current.position_ranking,
            nps: Number((current.nps_score - previous.nps_score).toFixed(1)),
            responses: current.responses_count - previous.responses_count
        }
    }

    const getVariationIcon = (variation: number | null) => {
        if (variation === null || variation === 0) return <Minus className="h-3 w-3 text-muted-foreground/30" />
        if (variation > 0) return <ArrowUp className="h-3 w-3 text-emerald-500" />
        if (variation < 0) return <ArrowDown className="h-3 w-3 text-red-500" />
        return <Minus className="h-3 w-3 text-muted-foreground/30" />
    }

    const getVariationBadge = (variation: number | null, isPositiveGood: boolean = true) => {
        if (variation === null) return <span className="text-[10px] font-bold text-muted-foreground/40">--</span>
        if (variation === 0) return <span className="text-[10px] font-bold text-muted-foreground/40">=</span>

        const isActuallyGood = isPositiveGood ? variation > 0 : variation < 0;

        return (
            <span className={`text-[10px] font-black ${isActuallyGood ? 'text-emerald-500' : 'text-red-500'}`}>
                {variation > 0 ? '+' : ''}{variation}
            </span>
        )
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
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="w-[60px] text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pos.</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unidade</TableHead>
                            <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">Var. Ranking</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amostragem</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">NPS</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Meta</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedMetrics.map((metric) => {
                            const variation = getVariation(metric)

                            return (
                                <TableRow key={metric.id}>
                                    <TableCell className="font-black text-lg italic tracking-tighter">
                                        #{metric.position_ranking}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-black text-xs uppercase tracking-tight text-foreground">{metric.units?.name}</span>
                                            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">{metric.units?.code}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1.5 bg-muted/30 py-1.5 px-3 rounded-xl border border-border/50">
                                            {getVariationIcon(variation.ranking)}
                                            {getVariationBadge(variation.ranking, true)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-bold text-sm tracking-tight">{metric.responses_count}</span>
                                            <div className="flex items-center gap-1">
                                                {getVariationIcon(variation.responses)}
                                                {getVariationBadge(variation.responses, true)}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-xl tracking-tighter text-foreground">{metric.nps_score?.toFixed(1)}</span>
                                            <div className="flex items-center gap-1">
                                                {getVariationIcon(variation.nps)}
                                                {getVariationBadge(variation.nps, true)}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-xs font-bold text-muted-foreground">
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
