
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configurar o worker para Node.js (se necessário, mas em versões recentes pode não precisar explícito se usar o build correto ou pode falhar sem worker)
// Para o teste rápido, vou tentar carregar sem worker worker ou mockar.
// Na versão 5+, o uso em Node é mais direto se usarmos o 'pdfjs-dist/legacy/build/pdf.js' para compatibilidade ou apenas o padrão.
// Vamos tentar o padrão. Se falhar, ajustamos.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDF_PATH = path.resolve(__dirname, '../_backup_nextjs/data/feedbacks.pdf');
const UNIT_CODE_PATTERN = /SBRSP[A-Z0-9]+/g;

async function extractTextFromPdf(buffer) {
    const data = new Uint8Array(buffer);
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item) => item.str)
            .join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
}

function splitTextByUnit(rawText) {
    const unitTexts = new Map();
    const matches = [...rawText.matchAll(UNIT_CODE_PATTERN)];

    if (matches.length === 0) {
        return unitTexts;
    }

    for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];

        const startIndex = currentMatch.index;
        const endIndex = nextMatch ? nextMatch.index : rawText.length;

        const unitCode = currentMatch[0];
        const unitText = rawText.slice(startIndex, endIndex);

        if (unitTexts.has(unitCode)) {
            unitTexts.set(unitCode, unitTexts.get(unitCode) + ' ' + unitText);
        } else {
            unitTexts.set(unitCode, unitText);
        }
    }

    return unitTexts;
}

function sanitizeComments(rawText) {
    // Tenta extração precisa baseada em âncoras
    const anchorPattern = /(?:Coment.rio:?)\s+([\s\S]+?)(?=(?:Feedback\s*\d)|(?:#\d+)|(?:SBRSP)|$)/gi;
    const anchoredMatches = [...rawText.matchAll(anchorPattern)];

    let potentialComments = [];

    if (anchoredMatches.length > 0) {
        potentialComments = anchoredMatches.map(m => m[1]);
    } else {
        // Fallback antigo
        let cleanText = rawText.replace(UNIT_CODE_PATTERN, '');
        cleanText = cleanText.replace(/\d{2}\/\d{2}\/\d{2,4}/g, '');
        cleanText = cleanText.replace(/\d{2}:\d{2}(:\d{2})?/g, '');

        cleanText = cleanText.replace(/Feedback \d:.*$/gmi, '');
        cleanText = cleanText.replace(/Feedback \d.*$/gmi, '');

        const metadataFields = [
            'Data:', 'Unidade:', 'Cliente:', 'CPF:', 'E-mail:', 'Telefone:',
            'NPS:', 'Nota:'
        ];
        metadataFields.forEach(field => {
            cleanText = cleanText.replace(new RegExp(`${field}.*$`, 'gmi'), '');
        });

        const ignoredPhrases = [
            'Cliente não autorizou contato', 'Sem contato', 'Usuário não deixou',
            'Não houve contato', 'Obtive contato'
        ];
        ignoredPhrases.forEach(phrase => {
            cleanText = cleanText.replace(new RegExp(phrase, 'gi'), '');
        });

        const labelsToRemove = ['Comentário:', 'Comentário'];
        labelsToRemove.forEach(label => {
            cleanText = cleanText.replace(new RegExp(label, 'gi'), '');
        });

        potentialComments = [cleanText];
    }

    return potentialComments
        .flatMap(comment => {
            let c = comment;
            c = c.replace(/#\d+/g, '');
            c = c.replace(/\(\/surveys\/.*\)/g, '');
            c = c.replace(/\(\/people\/.*\)/g, '');

            const ignoredPhrases = [
                'Cliente não autorizou contato', 'Sem contato',
                'Usuário não deixou', 'Não houve contato', 'Obtive contato'
            ];
            ignoredPhrases.forEach(phrase => {
                c = c.replace(new RegExp(phrase, 'gi'), '');
            });

            return c.split(/[\n\r]+|\s{3,}/);
        })
        .map(c => c.trim())
        .filter(c => c.length > 10)
        .filter(c => !/^\d+$/.test(c))
        .filter(c => !c.match(/^(Promotor|Detrator|Neutro)$/i))
        .filter(c => !c.toLowerCase().includes('usuário não deixou'))
        .filter(c => !c.toLowerCase().includes('cliente não autorizou'))
        .filter((val, idx, arr) => arr.indexOf(val) === idx);
}

async function run() {
    try {
        console.log(`Lendo arquivo: ${PDF_PATH}`);
        if (!fs.existsSync(PDF_PATH)) {
            console.error('Arquivo não encontrado!');
            return;
        }

        const buffer = fs.readFileSync(PDF_PATH);
        console.log('Extraindo texto do PDF...');
        const rawText = await extractTextFromPdf(buffer);
        console.log(`Texto extraído. Total caracteres: ${rawText.length}`);

        console.log('Separando por unidade...');
        const unitMap = splitTextByUnit(rawText);
        console.log(`Total de unidades encontradas: ${unitMap.size}`);

        console.log('\n--- RESULTADOS POR UNIDADE ---');
        for (const [code, text] of unitMap) {
            // DEBUG ESPECÍFICO PARA A UNIDADE QUE O USUÁRIO RECLAMOU
            if (code === 'SBRSPCBNF01') {
                console.log(`\n[DEBUG RAW TEXT SBRSPCBNF01] ---------------------`);
                console.log(text.substring(0, 500)); // Imprime os primeiros 500 caracters
                console.log(`---------------------------------------------------\n`);
            }

            const comments = sanitizeComments(text);
            console.log(`\nUNIDADE: ${code}`);
            console.log(`Comentários extraídos: ${comments.length}`);
            if (comments.length > 0) {
                console.log('Exemplos:');
                comments.slice(0, 3).forEach((c, i) => console.log(`  ${i + 1}. "${c}"`));
            } else {
                console.log('  (Nenhum comentário válido encontrado)');
            }
        }

    } catch (error) {
        console.error('Erro na execução:', error);
    }
}

run();
