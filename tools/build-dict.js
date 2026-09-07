#!/usr/bin/env node
/**
 * 離線英漢詞典建置腳本
 *
 *   npm run build:dict
 *
 * 來源：ECDICT（https://github.com/skywind3000/ECDICT，MIT License）
 * 產物：assets/data/dict.js   —— 繁體中文詞典（window.__EN_DICT__）
 *      assets/data/lemma.js  —— 不規則詞形還原表（window.__EN_LEMMA__）
 *
 * 設計取捨：
 *   1. 產物是 .js 而非 .json —— 本專案支援 file:// 直接開啟，
 *      該情境下 fetch('*.json') 會被同源政策擋掉，只有 <script> 能載入。
 *   2. 只收錄「原形詞」，變形交給 lemma-rules.js 的規則還原處理；
 *      規則推導不出的不規則變形才寫進 lemma.js。
 *   3. ECDICT 釋義為簡體，建置期以 opencc-js 一次轉為台灣繁體，
 *      執行期零轉換成本。
 *
 * 原始資料（共 68MB）不進版控，首次執行會自動下載至 .cache/。
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const OpenCC = require('opencc-js');
const { lemmaCandidates } = require('../assets/js/lemma-rules.js');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, '.cache');
const OUT_DIR = path.join(ROOT, 'assets', 'data');

const SOURCES = {
    'ecdict.csv': 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv',
    'lemma.en.txt': 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/lemma.en.txt',
};

// 詞頻門檻：BNC 或當代語料庫排名在此名次內者視為常用詞。
// 實測 30000 可覆蓋題庫 96.5% 詞次，再放寬只增體積不增覆蓋。
const FREQ_LIMIT = 30000;

// 釋義長度上限（tooltip 容納得下的字數）
const MAX_LINE = 34;
const MAX_TOTAL = 62;

// ==================== 工具 ====================

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const get = (u) =>
            https
                .get(u, (res) => {
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        res.resume();
                        return get(res.headers.location);
                    }
                    if (res.statusCode !== 200)
                        return reject(new Error(`HTTP ${res.statusCode} — ${u}`));
                    res.pipe(file);
                    file.on('finish', () => file.close(resolve));
                })
                .on('error', reject);
        get(url);
    });
}

async function ensureSources() {
    if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });
    for (const [name, url] of Object.entries(SOURCES)) {
        const dest = path.join(CACHE, name);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
            console.log(`  ✓ 已快取 ${name}`);
            continue;
        }
        console.log(`  ↓ 下載 ${name}（首次執行需要網路，之後會使用 .cache/）…`);
        await download(url, dest);
        console.log(`  ✓ 完成 ${name}（${(fs.statSync(dest).size / 1048576).toFixed(1)} MB）`);
    }
}

/**
 * RFC 4180 CSV 解析（ECDICT 的釋義欄含逗號與跨行引號，不能用 split(',')）
 * @param {string} text
 * @param {(row: string[]) => void} onRow
 */
function parseCsv(text, onRow) {
    let field = '';
    let row = [];
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else quoted = false;
            } else field += ch;
            continue;
        }
        if (ch === '"') {
            quoted = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\n') {
            row.push(field);
            onRow(row);
            row = [];
            field = '';
        } else if (ch !== '\r') {
            field += ch;
        }
    }
    if (field || row.length) {
        row.push(field);
        onRow(row);
    }
}

const toInt = (v) => {
    const n = parseInt(v || '0', 10);
    return Number.isNaN(n) ? 0 : n;
};

/**
 * 壓縮釋義：ECDICT 的 translation 以字面 \n 分隔多個詞性義項，
 * 其中 [网络] 開頭者為機器擷取的網路釋義，品質差且常與正式義項重複。
 */
function condense(translation) {
    const lines = translation
        .split(/\\n|\n/)
        .map((s) => s.trim())
        .filter((s) => s && !/^\[(网络|網絡|机|機)/.test(s));

    const kept = [];
    let total = 0;
    for (const line of lines) {
        const s = line.length > MAX_LINE ? line.slice(0, MAX_LINE) + '…' : line;
        if (total + s.length > MAX_TOTAL) break;
        kept.push(s);
        total += s.length;
        if (kept.length >= 2) break;
    }
    return kept.join('；') || translation.slice(0, MAX_LINE);
}

/** 掃描題庫，取出英文題幹與選項用到的所有詞形 */
function collectCorpusWords() {
    const candidates = [
        path.join(ROOT, 'database.md'),
        path.join(ROOT, '..', 'Template', 'output', 'questions'),
    ];
    const files = [];
    for (const p of candidates) {
        if (!fs.existsSync(p)) continue;
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
            for (const f of fs.readdirSync(p)) {
                if (f.endsWith('.md')) files.push(path.join(p, f));
            }
        } else files.push(p);
    }

    const words = new Set();
    for (const file of files) {
        const md = fs.readFileSync(file, 'utf8');
        for (const block of md.split(/\n## /)) {
            const en = block.match(
                /\*\*English[:：]?\*\*\s*([\s\S]*?)(?=\n\*\*中文|\n\*\*圖片|\n\*\*選項|\n\*\*參考答案|$)/,
            );
            const parts = en ? [en[1]] : [];
            for (const m of block.matchAll(/^-\s+[A-F]\.\s*(.+)$/gm)) {
                parts.push(m[1].replace(/（.+?）/g, ''));
            }
            for (const text of parts) {
                for (const w of text.matchAll(/[A-Za-z][A-Za-z'-]*/g))
                    words.add(w[0].toLowerCase());
            }
        }
    }
    console.log(`  ✓ 掃描 ${files.length} 份題庫，取得 ${words.size} 個詞形`);
    return words;
}

// ==================== 主流程 ====================

async function main() {
    console.log('📚 建置離線英漢詞典\n');

    console.log('[1/5] 準備原始資料');
    await ensureSources();

    console.log('\n[2/5] 掃描題庫詞彙');
    const corpus = collectCorpusWords();

    console.log('\n[3/5] 解析 ECDICT');
    const csv = fs.readFileSync(path.join(CACHE, 'ecdict.csv'), 'utf8');
    const raw = new Map(); // word → 簡體釋義
    const exchange = new Map(); // 變形 → 原形（來自 ECDICT exchange 欄）
    let header = null;
    let total = 0;

    parseCsv(csv, (row) => {
        if (!header) {
            header = row;
            return;
        }
        total++;
        const rec = {};
        header.forEach((k, i) => {
            rec[k] = row[i] || '';
        });

        const word = rec.word.trim().toLowerCase();
        const translation = rec.translation.trim();
        if (!word || !translation) return;
        // 只收純字母詞（排除數字、片語、含空白的條目）
        if (!/^[a-z][a-z'.-]{0,30}$/.test(word)) return;

        for (const part of rec.exchange.split('/')) {
            if (part.startsWith('0:')) {
                const base = part.slice(2).trim().toLowerCase();
                if (base && base !== word && !exchange.has(word)) exchange.set(word, base);
            }
        }

        const isCommon =
            (toInt(rec.bnc) > 0 && toInt(rec.bnc) <= FREQ_LIMIT) ||
            (toInt(rec.frq) > 0 && toInt(rec.frq) <= FREQ_LIMIT) ||
            toInt(rec.collins) > 0 ||
            toInt(rec.oxford) > 0;

        // 常用詞一律收錄；非常用詞只在題庫實際用到時收錄（例：phishing、rootkit）
        if ((isCommon || corpus.has(word)) && !raw.has(word)) raw.set(word, translation);
    });
    console.log(`  ✓ 讀入 ${total} 條，收錄 ${raw.size} 個詞`);

    console.log('\n[4/5] 簡體轉台灣繁體');
    const convert = OpenCC.Converter({ from: 'cn', to: 'twp' });
    const dict = {};
    for (const [word, translation] of raw) dict[word] = convert(condense(translation));
    console.log(`  ✓ 轉換 ${Object.keys(dict).length} 條釋義`);

    console.log('\n[5/5] 建立不規則詞形還原表');
    // 合併 ECDICT exchange 與 lemma.en.txt 兩份變形資料
    const inverse = new Map(exchange);
    for (const line of fs.readFileSync(path.join(CACHE, 'lemma.en.txt'), 'utf8').split('\n')) {
        const s = line.trim();
        if (!s || s.startsWith(';') || !s.includes('->')) continue;
        const [head, tail] = s.split('->');
        const base = head.split('/')[0].trim().toLowerCase();
        for (const v of tail.split(',')) {
            const variant = v.trim().toLowerCase();
            if (variant && variant !== base && !inverse.has(variant)) inverse.set(variant, base);
        }
    }

    const lemma = {};
    let skippedByRule = 0;
    for (const [variant, base] of inverse) {
        if (!(base in dict)) continue; // 原形不在詞典裡，記了也查不到
        if (variant in dict) continue; // 變形本身已有獨立詞條
        if (lemmaCandidates(variant).includes(base)) {
            skippedByRule++;
            continue;
        }
        lemma[variant] = base;
    }
    console.log(
        `  ✓ 保留 ${Object.keys(lemma).length} 條不規則變形（另有 ${skippedByRule} 條可由規則推導，已略過）`,
    );

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    const banner = (name) =>
        `/* 自動產生，請勿手動編輯 —— 執行 \`npm run build:dict\` 重新產生。\n` +
        `   資料來源：ECDICT (MIT License) https://github.com/skywind3000/ECDICT\n` +
        `   ${name} */\n`;

    // 以 JSON.parse(字串) 而非物件字面量輸出：V8 對前者有專用的快速解析路徑，
    // 在這種 MB 級資料上明顯快於逐一建構物件屬性。
    const asScript = (varName, obj) =>
        varName + '=JSON.parse(' + JSON.stringify(JSON.stringify(obj)) + ');\n';

    const dictPath = path.join(OUT_DIR, 'dict.js');
    const lemmaPath = path.join(OUT_DIR, 'lemma.js');
    fs.writeFileSync(dictPath, banner('英漢詞典') + asScript('window.__EN_DICT__', dict));
    fs.writeFileSync(
        lemmaPath,
        banner('不規則詞形還原表') + asScript('window.__EN_LEMMA__', lemma),
    );

    const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0) + ' KB';
    console.log(`\n✅ 完成`);
    console.log(`   assets/data/dict.js   ${kb(dictPath)}（${Object.keys(dict).length} 詞）`);
    console.log(`   assets/data/lemma.js  ${kb(lemmaPath)}（${Object.keys(lemma).length} 條）`);
}

main().catch((err) => {
    console.error('❌ 建置失敗：', err.message);
    process.exit(1);
});
