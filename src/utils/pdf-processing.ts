
// Padrão Regex para identificar códigos de unidade (SBRSP seguido de letras e números)
export const UNIT_CODE_PATTERN = /SBRSP[A-Z0-9]+/g

/**
 * Corta o texto por código de unidade usando Regex
 */
export function splitTextByUnit(rawText: string): Map<string, string> {
    const unitTexts = new Map<string, string>()

    // Encontrar todas as ocorrências de códigos de unidade
    const matches = [...rawText.matchAll(UNIT_CODE_PATTERN)]

    if (matches.length === 0) {
        console.warn('Nenhum código de unidade encontrado no PDF')
        return unitTexts
    }

    // Para cada código encontrado, extrair o texto até o próximo código
    for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i]
        const nextMatch = matches[i + 1]

        const startIndex = currentMatch.index!
        const endIndex = nextMatch ? nextMatch.index! : rawText.length

        const unitCode = currentMatch[0]
        const unitText = rawText.slice(startIndex, endIndex)

        // Acumular texto se o código já existir
        if (unitTexts.has(unitCode)) {
            unitTexts.set(unitCode, unitTexts.get(unitCode) + ' ' + unitText)
        } else {
            unitTexts.set(unitCode, unitText)
        }
    }

    return unitTexts
}

export interface Survey {
    id: string
    unitCode: string
    npsScore: number | null
    comment: string
    leaderFeedback: string
}

/**
 * Faz o parsing estruturado de todo o texto do PDF, extraindo pesquisas individuais.
 * Estratégia: Dividir o texto em blocos baseados no ID da pesquisa (#12345) para evitar Pular itens.
 */
export function extractSurveys(rawText: string): Survey[] {
    const surveys: Survey[] = []

    // Normaliza quebras de linha para evitar problemas com regex multilinha
    const normalizedText = rawText.replace(/\r\n/g, '\n')

    // 1. Dividir o texto em blocos, onde cada bloco começa com um ID de pesquisa (#\d+)
    const blocks = normalizedText.split(/(?=#\d{5,})/)

    const idPattern = /#(\d+)/
    const unitPattern = /(SBRSP[A-Z0-9]+)/

    // Status comuns para ajudar na ancoragem da nota
    const statusAnchors = ['Sem contato', 'Contato realizado', 'Cliente não', 'Não houve', 'Respondido', 'Em andamento']

    for (const block of blocks) {
        // Ignora blocos muito pequenos ou sem unidade
        if (block.length < 50 || !block.includes('SBRSP')) continue

        try {
            const idMatch = block.match(idPattern)
            const unitMatch = block.match(unitPattern)

            if (!idMatch || !unitMatch) continue

            const id = idMatch[1]
            const unitCode = unitMatch[0]

            let npsScore = null

            // Busca nota: trecho entre Unidade e "Comentário"
            const headerEndIndex = block.indexOf('Comentário')
            if (headerEndIndex > 0) {
                const headerPart = block.substring(0, headerEndIndex)
                // Procura números 0-10 isolados
                const numbers = headerPart.match(/\b(10|[0-9])\b/g)
                if (numbers && numbers.length > 0) {
                    // Assertividade: Pegar o último número encontrado nesse range
                    npsScore = parseInt(numbers[numbers.length - 1], 10)
                }
            }

            // Busca Comentário e Feedback
            const commentStart = block.indexOf('Comentário')
            let commentContent = ''
            let leaderFeedback = ''

            if (commentStart !== -1) {
                const feedbackStart = block.search(/Feedback\s*\d*:/) // Flexibiliza "Feedback:" ou "Feedback 1:"

                if (feedbackStart !== -1 && feedbackStart > commentStart) {
                    // Tem Feedback
                    const commentBodyStart = commentStart + 10 // Len 'Comentário'
                    commentContent = block.substring(commentBodyStart, feedbackStart).trim()

                    // Feedback
                    const feedbackRaw = block.substring(feedbackStart)
                    leaderFeedback = feedbackRaw.replace(/^Feedback\s*\d*:\s*/, '').trim()

                } else {
                    // Sem feedback, pega tudo até o fim do bloco
                    const commentBodyStart = commentStart + 10
                    commentContent = block.substring(commentBodyStart).trim()
                }
            }

            // Limpezas Finais
            commentContent = commentContent.replace(/^:\s*/, '')

            const ignoredPhrases = [
                'Usuário não deixou',
                'Não houve contato',
                'Cliente não autorizou',
                'Obtive contato',
                'Sem contato'
            ]

            let isValidComment = true
            if (commentContent.length < 3 || ignoredPhrases.some(p => commentContent.toLowerCase().includes(p.toLowerCase()))) {
                isValidComment = false
            }

            leaderFeedback = leaderFeedback.replace(/[\n\r]+/g, ' ').trim()
            commentContent = commentContent.replace(/[\n\r]+/g, ' ').trim()

            surveys.push({
                id,
                unitCode,
                npsScore,
                comment: isValidComment ? commentContent : '', // Mantemos vazio se for inválido
                leaderFeedback
            })

        } catch (err) {
            console.error('Erro ao processar bloco:', err)
        }
    }

    return surveys
}

/**
 * Limpa/Sanitiza o texto extraído
 */
export function sanitizeComments(rawText: string): string[] {
    // Agora usa o parser estruturado para garantir precisão
    const surveys = extractSurveys(rawText)

    // Retorna apenas os comentários que não estão vazios
    return surveys
        .filter(s => s.comment && s.comment.length > 0)
        .map(s => s.comment)
        // Remove duplicatas
        .filter((val, idx, arr) => arr.indexOf(val) === idx)
}
