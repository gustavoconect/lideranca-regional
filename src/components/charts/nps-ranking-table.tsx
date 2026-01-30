'use client'

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Metric {
    id: string
    nps_score: number
    promoters_count: number
    detractors_count: number
    goal_2026_1: number
    responses_count: number
    position_ranking: number
    units: {
        name: string
        code: string
    }
}

export function NpsRankingTable({ metrics }: { metrics: Metric[] }) {
    // Sort by ranking position
    const sortedMetrics = [...metrics].sort((a, b) => a.position_ranking - b.position_ranking)

    return (
        <Card className="col-span-2">
            <CardHeader>
                <CardTitle>Ranking de Unidades</CardTitle>
                <CardDescription>Desempenho NPS atualizado (Semestre 1 - 2026)</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[400px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Pos.</TableHead>
                                <TableHead>Unidade</TableHead>
                                <TableHead className="text-right">Respostas</TableHead>
                                <TableHead className="text-right">NPS</TableHead>
                                <TableHead className="text-right">Meta</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedMetrics.map((metric) => {
                                const isOnTarget = metric.nps_score >= metric.goal_2026_1
                                return (
                                    <TableRow key={metric.id}>
                                        <TableCell className="font-medium">#{metric.position_ranking}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{metric.units.name}</span>
                                                <span className="text-xs text-muted-foreground">{metric.units.code}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">{metric.responses_count}</TableCell>
                                        <TableCell className="text-right font-bold text-lg">
                                            {metric.nps_score?.toFixed(1)}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">{metric.goal_2026_1?.toFixed(1)}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={isOnTarget ? "default" : "destructive"}>
                                                {isOnTarget ? "Na Meta" : "Abaixo"}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                            {sortedMetrics.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                        Nenhum dado encontrado. Faça upload do CSV.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    )
}
