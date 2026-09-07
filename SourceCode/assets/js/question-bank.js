/**
 * Markdown 題庫純函式：瀏覽器與 Node 測試共用，無 DOM 或儲存依賴。
 * 欄位只在行首識別，程式碼區塊中的範例不參與解析。
 */
/** 題目圖片的存放目錄，相對於 index.html */
const IMAGE_BASE_DIR = 'images/';

/**
 * 正規化題庫中的圖片路徑
 *
 * 題庫的圖片多半寫成 `../images/q44_1.png`，那是相對於「題庫 md 檔自身位置」
 * 的寫法。但瀏覽器解析 <img src> 時的基準是「目前頁面的 URL」而非 md 檔，
 * 兩者不一致，圖片就會 404。
 *
 * 而且用「載入題庫」按鈕選檔時，瀏覽器基於安全考量不會提供 md 檔的磁碟路徑，
 * 任何相對於 md 的路徑在瀏覽器裡根本無從還原 —— 圖片只能放在網站目錄底下。
 *
 * 因此一律改寫為指向 index.html 同層的 images/：
 *   ../images/q44_1.png  →  images/q44_1.png
 *   ./images/2024/q1.png →  images/2024/q1.png   （保留 images/ 之後的子目錄）
 *   q44_1.png            →  images/q44_1.png
 * 外部網址與 data URI 則照原樣使用。
 *
 * @param {string} rawPath - 題庫 md 中寫的原始路徑
 * @returns {string} 可直接放進 <img src> 的路徑
 */
function normalizeImagePath(rawPath) {
    const path = String(rawPath || '').trim();
    if (!path) return '';

    // 外部資源照原樣使用（此時已不是離線資源，由使用者自行負責）
    if (/^(?:https?:|\/\/)/i.test(path)) return path;
    if (/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(path)) return path;
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return '';

    // 剝掉查詢字串與 hash，再統一分隔符號
    const cleaned = path.split(/[?#]/)[0].replace(/\\/g, '/');

    // 路徑中若含 images/ 這一段，保留其後的完整結構（子目錄不會被壓平）
    const scoped = cleaned.match(/(?:^|\/)images\/(.+)$/i);
    if (scoped)
        return (
            IMAGE_BASE_DIR +
            scoped[1]
                .split('/')
                .filter((part) => part && part !== '.' && part !== '..')
                .join('/')
        );

    // 否則只取檔名
    const fileName = cleaned.split('/').pop();
    return fileName ? IMAGE_BASE_DIR + fileName : '';
}

function parseQuestions(markdown) {
    const codeBlocks = [];
    const masked = String(markdown)
        .replace(/\r\n?/g, '\n')
        .replace(/^([ 	]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[ 	]*$/gm, (block) => {
            codeBlocks.push(block);
            return '\u0000CB' + (codeBlocks.length - 1) + '\u0000';
        });
    const restore = (text = '') =>
        text.replace(/\u0000CB(\d+)\u0000/g, (_, i) => codeBlocks[i]).trim();
    const headers = [
        ...masked.matchAll(/^##\s*(\*)?\s*第\s*(\d+)\s*題\s*【(單選題|多選題|簡答題)】[ 	]*$/gm),
    ];
    return headers
        .map((header, index) => {
            const block = masked.slice(header.index + header[0].length, headers[index + 1]?.index);
            const fields = [
                ...block.matchAll(
                    /^\*\*(English|中文|圖片|選項|正確答案|參考答案|題目解析)[：:]?([^*\n]*)\*\*[ 	]*/gm,
                ),
            ];
            const values = {};
            fields.forEach((field, fieldIndex) => {
                const body = block.slice(
                    field.index + field[0].length,
                    fields[fieldIndex + 1]?.index,
                );
                values[field[1]] = restore(field[2] + body.replace(/\n[ 	]*-{3,}[ 	]*\s*$/, ''));
            });
            const options = [...(values.選項 || '').matchAll(/^[ 	]*-\s*([A-F])\.\s*(.+)$/gm)].map(
                (match) => ({ letter: match[1], text: match[2].trim() }),
            );
            const correctAnswer = [...new Set((values.正確答案 || '').replace(/[,，\s]/g, ''))]
                .sort()
                .join('');
            const number = Number(header[2]);
            const type = header[3];
            const isShortAnswer = type === '簡答題';
            if (!Number.isSafeInteger(number) || number < 1 || !values.English) {
                throw new Error('第 ' + header[2] + ' 題：需要正整數題號與 English 題幹。');
            }
            if (
                isShortAnswer
                    ? !values.參考答案
                    : options.length < 2 ||
                      new Set(options.map((option) => option.letter)).size !== options.length ||
                      !/^[A-F]+$/.test(correctAnswer) ||
                      [...correctAnswer].some(
                          (letter) => !options.some((option) => option.letter === letter),
                      ) ||
                      (type === '單選題' && correctAnswer.length !== 1)
            ) {
                throw new Error('第 ' + number + ' 題：請檢查選項與答案。');
            }
            return {
                number,
                type,
                isMultiple: type === '多選題',
                isShortAnswer,
                isImportant: Boolean(header[1]),
                englishText: values.English,
                chineseText: values.中文 || '',
                imagePaths: [...(values.圖片 || '').matchAll(/!\[[^\]]*\]\(([^)]*)\)/g)]
                    .map((match) => normalizeImagePath(match[1]))
                    .filter(Boolean),
                options,
                correctAnswer,
                shortAnswer: values.參考答案 || null,
                explanation: values.題目解析 || null,
            };
        })
        .sort((a, b) => a.number - b.number);
}

/** 完整內容參與識別，避免同題號的不同題庫共用進度。 */
function computeBankId(list) {
    if (!list.length) return 'default';
    const signature = JSON.stringify(list);
    let hash = 5381;
    for (let i = 0; i < signature.length; i++) {
        hash = (Math.imul(hash, 33) ^ signature.charCodeAt(i)) >>> 0;
    }
    return 'v2-' + hash.toString(36);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseQuestions, computeBankId, normalizeImagePath };
}
