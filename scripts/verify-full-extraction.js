
import fs from 'fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

// NOVA Lógica baseada em split de blocos
function extractSurveys(rawText) {
    const surveys = []
    const normalizedText = rawText.replace(/\r\n/g, '\n')

    // 1. Dividir o texto em blocos baseados no ID (#d+)
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
                    // Ex: Comentário: ......... Feedback 1: ....
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

            // --- TRATAMENTO IDENTICO AO ANTERIOR ---
            // Remove ':' inicial residual
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
                comment: isValidComment ? commentContent : '[Sem Comentário Válido]',
                leaderFeedback
            })

        } catch (err) {
            console.error('Erro ao processar bloco:', err)
        }
    }

    return surveys
}

async function run() {
    const pdfPath = 'C:\\Users\\Gustavo\\Desktop\\Projeto Regional\\_backup_nextjs\\data\\feedbacks.pdf'
    console.log(`Lendo arquivo: ${pdfPath}`)

    const dataBuffer = fs.readFileSync(pdfPath)
    const uint8Array = new Uint8Array(dataBuffer)

    const loadingTask = pdfjs.getDocument({
        data: uint8Array,
        useSystemFonts: true,
        disableFontFace: true
    })

    const doc = await loadingTask.promise
    let fullText = ''

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const strings = content.items.map(item => item.str)
        fullText += strings.join(' ') + '\n'
    }

    console.log(`Texto extraído. Total caracteres: ${fullText.length}`)

    const surveys = extractSurveys(fullText)

    console.log(`\n--- JSON FINAL PARA O LLM (SEM TRUNCAMENTOS) ---`)

    // Simula a estrutura exata do Reports.tsx
    const groupedSurveys = {}

    surveys.forEach(survey => {
        if (!groupedSurveys[survey.unitCode]) {
            groupedSurveys[survey.unitCode] = {
                UnitCode: survey.unitCode,
                UnitName: survey.unitCode,
                Surveys: []
            }
        }

        groupedSurveys[survey.unitCode].Surveys.push({
            Comment: survey.comment || "[Sem Comentário]",
            Score: survey.npsScore,
            LeaderFeedback: survey.leaderFeedback
        })
    })

    const finalJson = JSON.stringify(Object.values(groupedSurveys), null, 2)
    console.log(finalJson)
}

run().catch(console.error)
