/**
 * LogicTutorAI - 測驗作答系統
 * 完整 JavaScript 邏輯
 *
 * 注意：此文件包含所有 JavaScript 邏輯。
 * 後續可按以下方式進一步拆分：
 * - ui.js: 所有 UI 更新和 DOM 操作（renderQuestion, updateStats 等）
 * - handlers.js: 所有事件處理器（selectSingleOption, submitMultipleChoice 等）
 * - main.js: 全域狀態和核心邏輯（保留）
 */

// ==================== 全域狀態 ====================
let questions = [];           // 所有題目
let currentIndex = 0;         // 當前題目索引
let showChinese = false;      // 是否顯示中文
let answerState = {};         // 答題狀態 { questionNum: 'correct' | 'wrong' }
let userAnswers = {};         // 使用者實際作答 { questionNum: 'A' | 'AC' }
let selectedOptions = [];     // 多選題已選選項
let hasAnswered = false;      // 當前題目是否已作答
let randomJumpEnabled = false; // 隨機跳題功能
let keywordHighlightEnabled = true; // 關鍵字高亮功能（預設啟用）

// 題庫識別碼：不同題庫的作答進度彼此隔離，避免統計數字互相污染
let bankId = 'default';

// 閱讀範圍設定
let rangeEnabled = false;     // 是否啟用範圍限制
let rangeStart = 1;           // 起始題號
let rangeEnd = null;          // 結束題號（null 表示到最後一題）
let showImportantOnly = false; // 是否僅顯示重要題目
let wrongOnlyEnabled = false;  // 僅複習答錯的題目

// 題型過濾設定
let enabledQuestionTypes = ['單選題', '多選題', '簡答題'];

// 搜尋狀態
let searchKeyword = '';       // 目前的搜尋關鍵字（空字串表示未搜尋）

// GROQ AI 設定
let groqApiKey = '';          // GROQ API Key
let groqModel = 'openai/gpt-oss-20b';  // 預設模型
let availableModels = [];     // 可用模型列表

// ==================== 倒數計時器設定 ====================
let timerEnabled = true;       // 是否啟用計時器（預設啟用）
let timerDuration = 60;        // 計時器時間（秒，預設 60 秒）
let timeRemaining = 0;         // 剩餘時間
let timerInterval = null;      // 計時器 interval 參考
let timerStartTime = 0;        // 計時器總時長（秒）
let timerDeadline = 0;         // 計時器到期時間戳（毫秒）
let timerQuestionNum = null;   // 計時器所屬題號，用於判斷是否需要重新計時

// ==================== 題庫解析器 ====================
/**
 * 解析 Markdown 題庫檔案
 * @param {string} markdown - Markdown 原始內容
 * @returns {Array} 題目陣列
 */
function parseQuestions(markdown) {
    const questions = [];

    // 遮蔽 fenced code block，避免說明用的範例語法被誤判為真實題目欄位
    const codeBlocks = [];
    const masked = markdown.replace(/```[\s\S]*?```/g, match => {
        codeBlocks.push(match);
        return `\u0000CB${codeBlocks.length - 1}\u0000`;
    });
    const restore = text => (text == null ? text
        : text.replace(/\u0000CB(\d+)\u0000/g, (_, i) => codeBlocks[i]));

    // 以「獨立成行」的 --- 分隔各題（避免表格分隔列 |---|---| 被誤判為分隔線）
    const blocks = masked.split(/^[ \t]*-{3,}[ \t]*$/m).filter(block => block.trim());

    for (const block of blocks) {
        // 解析題號與題型（支援 ## *第 XXX 題 格式，星號表示重要題目）
        // 支援：單選題、多選題、簡答題
        const headerMatch = block.match(/##\s*(\*)?\s*第\s*(\d+)\s*題\s*【(單選題|多選題|簡答題)】/);
        if (!headerMatch) continue;

        const isImportant = headerMatch[1] === '*';
        const questionNum = parseInt(headerMatch[2]);
        const questionType = headerMatch[3];
        const isMultiple = questionType === '多選題';
        const isShortAnswer = questionType === '簡答題';

        // 解析英文題目
        const englishMatch = block.match(/\*\*English:\*\*\s*([\s\S]*?)(?=\*\*中文：\*\*|\*\*圖片[：:]?\*\*|\!\[|\*\*選項：\*\*|\*\*參考答案[：:]?\*\*|$)/);
        const englishText = restore(englishMatch ? englishMatch[1].trim() : '');

        // 解析中文題目（簡答題可能後接 **圖片** 或 **參考答案**）
        const chineseMatch = block.match(/\*\*中文：\*\*\s*([\s\S]*?)(?=(?:\*\*圖片[：:]?\*\*|\!\[|\*\*選項：\*\*|\*\*參考答案[：:]?\*\*|$))/);
        const chineseText = restore(chineseMatch ? chineseMatch[1].trim() : '');

        // 解析圖片（支援多張、任意 alt 文字；僅掃描「題目解析」之前的區段，
        // 避免解析內容中的示意圖被誤收為題目附圖）
        const imageScope = block.split(/\*\*題目解析[：:]?\*\*/)[0];
        const imageMatches = [...imageScope.matchAll(/!\[[^\]]*\]\(([^)]*)\)/g)];
        const imagePaths = imageMatches.map(m => m[1]);

        let options = [];
        let correctAnswer = '';
        let shortAnswer = null;

        if (isShortAnswer) {
            // 簡答題：解析參考答案區塊
            const shortAnswerMatch = block.match(/\*\*參考答案[：:]?\*\*\s*([\s\S]*?)(?=(?:\*\*題目解析[：:]?\*\*|$))/);
            shortAnswer = restore(shortAnswerMatch ? shortAnswerMatch[1].trim() : null);
        } else {
            // 選擇題：解析選項
            const optionsMatch = block.match(/\*\*選項：\*\*\s*([\s\S]*?)(?=\*\*正確答案)/);
            const optionsText = optionsMatch ? optionsMatch[1].trim() : '';
            const optionLines = optionsText.split('\n').filter(line => line.trim().startsWith('-'));

            options = optionLines.map(line => {
                // 移除開頭的 "- " 並解析選項
                const cleaned = line.replace(/^-\s*/, '').trim();
                const letterMatch = cleaned.match(/^([A-F])\.\s*(.*)/);
                if (letterMatch) {
                    return {
                        letter: letterMatch[1],
                        text: letterMatch[2]
                    };
                }
                return null;
            }).filter(opt => opt !== null);

            // 解析正確答案（支援連續格式 AB 或逗號分隔格式 A,B）
            const answerMatch = block.match(/\*\*正確答案：([A-F,]+)\*\*/);
            // 移除逗號，統一為連續字母格式（例如 A,B -> AB）
            correctAnswer = answerMatch ? answerMatch[1].replace(/,/g, '') : '';
        }

        // 解析題目解析（可選欄位）
        const explanationMatch = block.match(/\*\*題目解析[：:]?\*\*\s*([\s\S]*?)(?=$)/);
        const explanation = restore(explanationMatch ? explanationMatch[1].trim() : null);

        questions.push({
            number: questionNum,
            type: questionType,
            isMultiple,
            isShortAnswer,
            isImportant,
            englishText,
            chineseText,
            imagePaths,
            options,
            correctAnswer,
            shortAnswer,
            explanation
        });
    }

    // 依題號排序
    questions.sort((a, b) => a.number - b.number);
    return questions;
}

/**
 * 計算題庫識別碼（以題數與題號序列產生短雜湊）
 *
 * 不同題庫使用各自獨立的 localStorage 命名空間，
 * 避免切換題庫時沿用到上一份題庫的作答紀錄而造成統計失真。
 * @param {Array} list - 題目陣列
 * @returns {string} 題庫識別碼
 */
function computeBankId(list) {
    if (!list.length) return 'default';
    const signature = `${list.length}:${list[0].number}:${list[list.length - 1].number}:` +
        list.slice(0, 20).map(q => `${q.number}${q.type}`).join('');
    let hash = 5381;
    for (let i = 0; i < signature.length; i++) {
        hash = ((hash << 5) + hash + signature.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36);
}

/**
 * 套用解析後的題庫並完成初始化
 *
 * 集中處理題號重複偵測、進度命名空間切換與初始渲染，
 * 供自動載入、手動載入與重新載入三種進入點共用。
 * @param {Array} parsed - parseQuestions 的結果
 * @returns {boolean} 是否成功套用
 */
function applyQuestions(parsed) {
    if (!parsed || parsed.length === 0) return false;

    // 多檔合併時可能出現重複題號，重複的題目會導致答題卡同號多格且狀態連動
    const seen = new Set();
    const duplicates = [];
    questions = parsed.filter(q => {
        if (seen.has(q.number)) {
            duplicates.push(q.number);
            return false;
        }
        seen.add(q.number);
        return true;
    });

    bankId = computeBankId(questions);
    loadSavedProgress();
    initQuiz();

    if (duplicates.length > 0) {
        showToast(`已略過 ${duplicates.length} 題重複題號（第 ${duplicates.slice(0, 3).join('、')} 題等）`, 'warn');
    }
    return true;
}

// ==================== 題庫載入 ====================
/**
 * 嘗試自動載入同目錄下的題庫檔案
 *
 * 以 file:// 開啟時瀏覽器會因同源政策阻擋 fetch，此時直接引導使用者手動選檔，
 * 不再讓畫面停在沒有說明的空狀態。
 */
async function autoLoadQuestions() {
    if (location.protocol === 'file:') {
        showEmptyState('離線模式（file://）無法自動讀取題庫，請點擊「載入題庫」選擇 Markdown 檔案');
        return;
    }

    try {
        const response = await fetch('database.md');
        if (response.ok) {
            const markdown = await response.text();
            if (applyQuestions(parseQuestions(markdown))) return;
        }
    } catch (e) {
        console.warn('自動載入題庫失敗，等待手動選擇檔案', e);
    }
    // 顯示空狀態
    showEmptyState();
}

/**
 * 從檔案輸入載入題庫（支援多檔案合併）
 */
async function loadFileFromInput(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    showLoadingState();

    try {
        // 讀取所有檔案內容
        const readFile = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });
        };

        // 並行讀取所有檔案
        const contents = await Promise.all(
            Array.from(files).map(file => readFile(file))
        );

        // 合併所有 MD 內容（用 --- 分隔符連接）
        const mergedMarkdown = contents.join('\n\n---\n\n');

        if (applyQuestions(parseQuestions(mergedMarkdown))) {
            showToast(`已載入 ${files.length} 個檔案，共 ${questions.length} 題`, 'success');
        } else {
            showToast('無法解析題庫檔案，請確認格式正確', 'error');
            showEmptyState();
        }
    } catch (error) {
        console.error('載入檔案時發生錯誤:', error);
        showToast('載入檔案時發生錯誤，請重試', 'error');
        showEmptyState();
    }

    // 清空 file input，讓使用者可以再次選擇相同檔案
    event.target.value = '';
}

/**
 * 重新載入題庫
 */
async function reloadQuestions() {
    if (location.protocol === 'file:') {
        showToast('離線模式無法自動重新載入，請使用「載入題庫」選擇檔案', 'warn');
        return;
    }

    showLoadingState();
    try {
        const response = await fetch('database.md', { cache: 'no-cache' });
        if (response.ok) {
            const markdown = await response.text();
            if (applyQuestions(parseQuestions(markdown))) return;
        }
    } catch (e) {
        console.warn('重新載入題庫失敗', e);
    }
    showToast('重新載入失敗，請使用「載入題庫」按鈕手動選擇檔案', 'error');
    showQuizContainer();
}

// ==================== UI 狀態管理 ====================
function showLoadingState() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('quizContainer').classList.add('hidden');
}

/**
 * 顯示空狀態
 * @param {string} [message] - 額外的說明訊息（例如離線模式提示）
 */
function showEmptyState(message) {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('quizContainer').classList.add('hidden');

    const hint = document.getElementById('emptyStateHint');
    if (hint) {
        if (message) {
            hint.textContent = message;
            hint.classList.remove('hidden');
        } else {
            hint.classList.add('hidden');
        }
    }
}

function showQuizContainer() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('quizContainer').classList.remove('hidden');
}

// ==================== 題目初始化與渲染 ====================
/**
 * 初始化測驗
 */
function initQuiz() {
    showQuizContainer();
    generateAnswerCard();
    renderQuestion();
    updateStats();
    updateJumpInputMax();
}

/**
 * 生成答題卡格子
 *
 * 使用 DocumentFragment 批次插入並以事件委派取代逐格綁定，
 * 大題庫（千題以上）下可避免大量 reflow 與事件閉包的記憶體開銷。
 */
function generateAnswerCard() {
    const container = document.getElementById('answerCard');
    container.innerHTML = '';

    const validIndices = new Set(getValidIndices());
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const div = document.createElement('button');
        div.type = 'button';
        div.className = 'answer-card-item w-8 h-8 flex items-center justify-center text-xs font-medium rounded transition-colors';
        div.textContent = question.number;
        div.dataset.index = i;
        div.dataset.num = question.number;
        div.setAttribute('aria-label', `第 ${question.number} 題`);

        updateCardItemColor(div, question, validIndices.has(i));
        fragment.appendChild(div);
    }

    container.appendChild(fragment);
}

/**
 * 答題卡點擊處理（事件委派）
 *
 * 被過濾條件排除的題目不可點擊，避免答題卡繞過閱讀範圍、
 * 題型過濾等設定而跳到不該出現的題目。
 */
function handleAnswerCardClick(event) {
    const item = event.target.closest('.answer-card-item');
    if (!item) return;

    const index = parseInt(item.dataset.index, 10);
    if (Number.isNaN(index)) return;

    if (!getValidIndices().includes(index)) {
        showToast(`第 ${questions[index].number} 題不在目前的篩選範圍內`, 'warn');
        return;
    }

    currentIndex = index;
    renderQuestion();
}

/**
 * 更新答題卡格子顏色
 * @param {HTMLElement} element - 格子元素
 * @param {Object} question - 對應的題目物件
 * @param {boolean} inRange - 是否符合目前的篩選條件
 */
function updateCardItemColor(element, question, inRange = true) {
    const state = answerState[question.number];

    element.classList.remove(
        'bg-green-500', 'bg-red-500', 'bg-slate-600', 'bg-slate-700', 'text-white',
        'text-slate-400', 'text-slate-300', 'text-emerald-400',
        'border', 'border-emerald-500', 'opacity-30', 'cursor-pointer', 'cursor-not-allowed'
    );

    if (question.isShortAnswer) {
        // 簡答題使用特殊顏色（深綠色邊框）
        element.classList.add('bg-slate-700', 'text-emerald-400', 'border', 'border-emerald-500');
    } else if (state === 'correct') {
        element.classList.add('bg-green-500', 'text-white');
    } else if (state === 'wrong') {
        element.classList.add('bg-red-500', 'text-white');
    } else {
        element.classList.add('bg-slate-600', 'text-slate-300');
    }

    // 不在篩選範圍內的題目淡化並停用
    element.classList.add(inRange ? 'cursor-pointer' : 'cursor-not-allowed');
    if (!inRange) element.classList.add('opacity-30');
    element.disabled = !inRange;
}

/**
 * 更新單一答題卡格子
 */
function updateSingleCardItem(questionNum) {
    const item = document.querySelector(`#answerCard .answer-card-item[data-num="${questionNum}"]`);
    if (!item) return;

    const index = parseInt(item.dataset.index, 10);
    updateCardItemColor(item, questions[index], getValidIndices().includes(index));
}

/**
 * 重新整理答題卡的可用狀態
 *
 * 於篩選條件變更後呼叫，讓答題卡與導航邏輯保持一致。
 */
function refreshAnswerCardAvailability() {
    if (questions.length === 0) return;

    const validIndices = new Set(getValidIndices());
    document.querySelectorAll('#answerCard .answer-card-item').forEach(item => {
        const index = parseInt(item.dataset.index, 10);
        updateCardItemColor(item, questions[index], validIndices.has(index));
    });
}

/**
 * 渲染當前題目
 */
/**
 * 渲染當前題目
 * @param {Object} [opts]
 * @param {boolean} [opts.restartTimer=true] - 是否重新計時。
 *        僅在「切換到不同題目」時才應重新計時；切換翻譯或關鍵字高亮
 *        只是重繪同一題，重新計時等同於變相延長作答時間。
 */
function renderQuestion(opts = {}) {
    if (questions.length === 0) return;

    const { restartTimer = true } = opts;
    const q = questions[currentIndex];
    hasAnswered = !!answerState[q.number];
    selectedOptions = [];

    // 隱藏 AI 解析區塊（切換題目時重設）
    document.getElementById('aiAnalysisSection').classList.add('hidden');

    // 關閉解析面板（切換題目時重設）
    if (isExplanationPanelOpen) {
        closeExplanationPanel();
    }

    // 顯示/隱藏解析提示按鈕（只有有解析的題目才顯示）
    const explanationBtn = document.getElementById('explanationBtn');
    const importantBadge = document.getElementById('importantBadge');
    if (q.explanation) {
        explanationBtn.classList.remove('hidden');
        explanationBtn.classList.add('flex');
    } else {
        explanationBtn.classList.add('hidden');
        explanationBtn.classList.remove('flex');
    }

    // 顯示/隱藏重要標籤（題目標題有星號時顯示）
    if (importantBadge) {
        if (q.isImportant) {
            importantBadge.classList.remove('hidden');
        } else {
            importantBadge.classList.add('hidden');
        }
    }

    // 更新題號
    document.getElementById('questionNumber').textContent = `第 ${q.number} 題 / ${questions.length} 題`;

    // 更新題型
    const typeEl = document.getElementById('questionType');
    typeEl.textContent = q.type;
    // 簡答題用綠色、多選題用紫色、單選題用藍色
    let typeClass = 'bg-blue-600/20 text-blue-400';
    if (q.isShortAnswer) {
        typeClass = 'bg-green-600/20 text-green-400';
    } else if (q.isMultiple) {
        typeClass = 'bg-purple-600/20 text-purple-400';
    }
    typeEl.className = 'px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ' + typeClass;

    // 顯示/隱藏查看圖片按鈕（附圖片題才顯示）
    const viewImageBtn = document.getElementById('viewImageBtn');
    if (q.imagePaths && q.imagePaths.length > 0) {
        viewImageBtn.classList.remove('hidden');
        viewImageBtn.classList.add('flex');
        // 更新按鈕文字顯示圖片數量
        const btnText = viewImageBtn.querySelector('span');
        btnText.textContent = q.imagePaths.length > 1 ? `查看圖片 (${q.imagePaths.length})` : '查看圖片';
        // 生成 Dialog 圖片內容
        const imageWrapper = document.getElementById('imageWrapper');
        imageWrapper.innerHTML = q.imagePaths.map((path, index) => `
            <div class="w-full flex flex-col items-center">
                ${q.imagePaths.length > 1 ? `<p class="text-sm text-slate-400 mb-2">圖片 ${index + 1} / ${q.imagePaths.length}</p>` : ''}
                <img src="${escapeHtml(path)}" alt="題目圖片 ${index + 1}"
                     class="max-w-full object-contain select-none shadow-2xl rounded border border-slate-700"
                     draggable="false">
            </div>
        `).join('');
    } else {
        viewImageBtn.classList.add('hidden');
        viewImageBtn.classList.remove('flex');
    }

    // 顯示內嵌圖片區域（題目下方直接顯示）
    const imageContainer = document.getElementById('questionImage');
    if (q.imagePaths && q.imagePaths.length > 0) {
        imageContainer.classList.remove('hidden');
        imageContainer.innerHTML = q.imagePaths.map((path, index) => `
            <div class="flex flex-col items-center">
                ${q.imagePaths.length > 1 ? `<p class="text-sm text-slate-400 mb-2">圖片 ${index + 1} / ${q.imagePaths.length}</p>` : ''}
                <img src="${escapeHtml(path)}" alt="題目圖片 ${index + 1}" loading="lazy"
                     class="max-w-full rounded-lg border border-slate-600 shadow-lg cursor-pointer hover:border-blue-500 transition-colors"
                     onclick="openImageDialog()"
                     title="點擊放大查看">
            </div>
        `).join('');
    } else {
        imageContainer.classList.add('hidden');
        imageContainer.innerHTML = '';
    }

    // 顯示題目文字（支援反引號關鍵字高亮）
    // 若該題沒有中文翻譯，回退顯示英文原文，避免出現整片空白
    const hasChinese = !!(q.chineseText && q.chineseText.trim());
    const questionText = (showChinese && hasChinese) ? q.chineseText : q.englishText;
    document.getElementById('questionText').innerHTML = highlightKeywords(questionText);

    const noTranslationHint = document.getElementById('noTranslationHint');
    if (noTranslationHint) {
        noTranslationHint.classList.toggle('hidden', !(showChinese && !hasChinese));
    }

    // 更新翻譯按鈕狀態
    document.getElementById('translateBtnText').textContent = showChinese ? '顯示英文原文' : '顯示中文翻譯';

    // 渲染選項（簡答題則渲染查看答案按鈕）
    renderOptions(q);

    // 顯示/隱藏多選題提交按鈕（簡答題不顯示）
    const submitBtnContainer = document.getElementById('submitBtnContainer');
    if (q.isMultiple && !hasAnswered && !q.isShortAnswer) {
        submitBtnContainer.classList.remove('hidden');
    } else {
        submitBtnContainer.classList.add('hidden');
    }

    // 顯示/隱藏簡答題查看答案區塊
    const shortAnswerSection = document.getElementById('shortAnswerSection');
    if (shortAnswerSection) {
        if (q.isShortAnswer) {
            shortAnswerSection.classList.remove('hidden');
            // 重設答案顯示狀態
            const shortAnswerContent = document.getElementById('shortAnswerContent');
            const showAnswerBtn = document.getElementById('showAnswerBtn');
            if (shortAnswerContent && showAnswerBtn) {
                shortAnswerContent.classList.add('hidden');
                showAnswerBtn.classList.remove('hidden');
            }
        } else {
            shortAnswerSection.classList.add('hidden');
        }
    }

    // 隱藏結果訊息
    document.getElementById('resultMessage').classList.add('hidden');

    // 更新導航按鈕狀態
    document.getElementById('prevBtn').disabled = currentIndex === 0;
    document.getElementById('nextBtn').disabled = currentIndex === questions.length - 1;

    // 更新跳題輸入框
    document.getElementById('jumpInput').value = q.number;

    // 啟動計時器（如果未作答）
    if (!hasAnswered && timerEnabled) {
        // 同一題重繪時保留既有倒數，只有切換題目才重新計時
        if (restartTimer || timerQuestionNum !== q.number || timerInterval === null) {
            startTimer(timerDuration, q.number);
        }
    } else {
        stopTimer();
    }

    // 如果已作答，顯示結果
    if (hasAnswered) {
        showAnswerResult(q, answerState[q.number] === 'correct');
    }
}

/**
 * 渲染選項
 */
function renderOptions(question) {
    const container = document.getElementById('optionsContainer');
    container.innerHTML = '';

    // 簡答題不渲染選項
    if (question.isShortAnswer) {
        return;
    }

    const correctLetters = question.correctAnswer.split('');
    const chosenLetters = (userAnswers[question.number] || '').split('').filter(Boolean);

    question.options.forEach(opt => {
        const isCorrect = correctLetters.includes(opt.letter);
        const isChosen = chosenLetters.includes(opt.letter);

        const div = document.createElement('div');
        div.className = 'option-btn flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all';
        div.dataset.letter = opt.letter;

        // 根據已作答狀態設定樣式
        if (hasAnswered) {
            div.classList.add('answered', 'cursor-default');
            if (isCorrect) {
                div.classList.add('border-green-500', 'bg-green-500/10');
            } else if (isChosen) {
                // 標示使用者選錯的選項，讓答錯後能直接對照自己的選擇與正解
                div.classList.add('border-red-500', 'bg-red-500/10');
            } else {
                div.classList.add('border-slate-600', 'bg-slate-800/50');
            }
        } else {
            div.classList.add('border-slate-600', 'bg-slate-800/50', 'hover:border-blue-500');
        }

        // 多選題使用核取方塊
        if (question.isMultiple) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'checkbox-custom';
            checkbox.disabled = hasAnswered;
            checkbox.dataset.letter = opt.letter;
            checkbox.onchange = (e) => {
                e.stopPropagation();
                if (e.target.checked) {
                    selectedOptions.push(opt.letter);
                } else {
                    selectedOptions = selectedOptions.filter(l => l !== opt.letter);
                }
            };
            div.appendChild(checkbox);

            // 雙擊選項切換核取方塊（避免誤觸）
            if (!hasAnswered) {
                div.ondblclick = () => {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                };
            }
        } else {
            // 單選題使用圓形指示器
            const indicator = document.createElement('div');
            indicator.className = 'w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm shrink-0';
            if (hasAnswered && isCorrect) {
                indicator.classList.add('border-green-500', 'bg-green-500', 'text-white');
            } else if (hasAnswered && isChosen) {
                indicator.classList.add('border-red-500', 'bg-red-500', 'text-white');
            } else {
                indicator.classList.add('border-slate-500', 'text-slate-400');
            }
            indicator.textContent = opt.letter;
            div.appendChild(indicator);

            // 單選題雙擊事件（避免誤觸）
            if (!hasAnswered) {
                div.ondblclick = () => selectSingleOption(opt.letter, question);
            }
        }

        // 選項文字（支援反引號關鍵字高亮）
        const textSpan = document.createElement('span');
        textSpan.className = 'flex-1';
        // 解析選項中的中英文
        if (showChinese) {
            // 嘗試提取中文部分（括號內）
            const chineseMatch = opt.text.match(/（(.+?)）/);
            const displayText = chineseMatch ? `${opt.letter}. ${chineseMatch[1]}` : `${opt.letter}. ${opt.text}`;
            textSpan.innerHTML = highlightKeywords(displayText);
        } else {
            // 只顯示英文部分
            const englishText = opt.text.replace(/（.+?）/, '').trim();
            const displayText = `${opt.letter}. ${englishText}`;
            textSpan.innerHTML = highlightKeywords(displayText);
        }
        div.appendChild(textSpan);

        container.appendChild(div);
    });
}

/**
 * 單選題選擇選項
 */
function selectSingleOption(letter, question) {
    if (hasAnswered) return;

    const isCorrect = letter === question.correctAnswer;
    hasAnswered = true;
    answerState[question.number] = isCorrect ? 'correct' : 'wrong';
    userAnswers[question.number] = letter;

    // 停止計時器
    stopTimer();

    saveProgress();
    updateSingleCardItem(question.number);
    updateStats();

    // 重新渲染選項以顯示結果
    renderOptions(question);
    showAnswerResult(question, isCorrect, letter);

    // 答對自動跳下一題
    if (isCorrect) {
        // 隨機跳題模式：檢查是否還有可跳題目
        // 一般模式：檢查是否還有下一題
        const canJump = randomJumpEnabled ? getRandomNextIndex() !== -1 : currentIndex < questions.length - 1;
        if (canJump) {
            setTimeout(() => {
                nextQuestion();
            }, 800);
        }
    }
}

/**
 * 多選題提交答案
 */
function submitMultipleChoice() {
    const q = questions[currentIndex];
    if (hasAnswered || selectedOptions.length === 0) return;

    // 排序後比較
    const userAnswer = selectedOptions.sort().join('');
    const correctAnswer = q.correctAnswer.split('').sort().join('');
    const isCorrect = userAnswer === correctAnswer;

    hasAnswered = true;
    answerState[q.number] = isCorrect ? 'correct' : 'wrong';
    userAnswers[q.number] = userAnswer;

    // 停止計時器
    stopTimer();

    saveProgress();
    updateSingleCardItem(q.number);
    updateStats();

    // 隱藏提交按鈕
    document.getElementById('submitBtnContainer').classList.add('hidden');

    // 重新渲染選項以顯示結果
    renderOptions(q);
    showAnswerResult(q, isCorrect, userAnswer);

    // 答對自動跳下一題
    if (isCorrect) {
        // 隨機跳題模式：檢查是否還有可跳題目
        // 一般模式：檢查是否還有下一題
        const canJump = randomJumpEnabled ? getRandomNextIndex() !== -1 : currentIndex < questions.length - 1;
        if (canJump) {
            setTimeout(() => {
                nextQuestion();
            }, 800);
        }
    }
}

/**
 * 簡答題：顯示參考答案
 */
function showShortAnswer() {
    const q = questions[currentIndex];
    if (!q || !q.isShortAnswer) return;

    // 停止計時器（用戶查看答案時）
    stopTimer();

    const showAnswerBtn = document.getElementById('showAnswerBtn');
    const shortAnswerContent = document.getElementById('shortAnswerContent');

    if (showAnswerBtn && shortAnswerContent) {
        showAnswerBtn.classList.add('hidden');
        shortAnswerContent.classList.remove('hidden');

        // 使用 marked.js 渲染 Markdown 內容（支援表格等格式）
        if (q.shortAnswer) {
            if (typeof marked !== 'undefined') {
                shortAnswerContent.innerHTML = marked.parse(q.shortAnswer);
            } else {
                // 如果 marked.js 未載入，直接顯示原始內容
                shortAnswerContent.innerHTML = `<pre class="whitespace-pre-wrap">${q.shortAnswer}</pre>`;
            }
        } else {
            shortAnswerContent.innerHTML = '<p class="text-slate-400">此題無參考答案</p>';
        }
    }
}

/**
 * 簡答題：隱藏參考答案
 */
function hideShortAnswer() {
    const showAnswerBtn = document.getElementById('showAnswerBtn');
    const shortAnswerContent = document.getElementById('shortAnswerContent');

    if (showAnswerBtn && shortAnswerContent) {
        showAnswerBtn.classList.remove('hidden');
        shortAnswerContent.classList.add('hidden');
    }
}

/**
 * 顯示答題結果
 */
function showAnswerResult(question, isCorrect, userAnswer = '') {
    const resultEl = document.getElementById('resultMessage');
    resultEl.classList.remove('hidden');

    if (isCorrect) {
        resultEl.className = 'mt-6 p-4 rounded-xl bg-green-500/20 border border-green-500/50';
        resultEl.innerHTML = `
            <div class="flex items-center gap-2 text-green-400 font-semibold">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                答對了！
            </div>
        `;
        return;
    }

    // 重新作答時參數會帶入使用者答案；重繪已作答題目時則從紀錄取回
    const chosen = userAnswer || userAnswers[question.number] || '';
    resultEl.className = 'mt-6 p-4 rounded-xl bg-red-500/20 border border-red-500/50';
    resultEl.innerHTML = `
        <div class="flex items-center gap-2 text-red-400 font-semibold mb-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            答錯了！
        </div>
        <p class="text-slate-300">
            ${chosen ? `你的答案：<span class="text-red-400 font-bold">${escapeHtml(chosen)}</span>　｜　` : ''}正確答案：<span class="text-green-400 font-bold">${escapeHtml(question.correctAnswer)}</span>
        </p>
    `;
}

// ==================== 導航功能 ====================

/**
 * 取得有效的題目範圍（考慮閱讀範圍設定）
 */
function getValidRange() {
    if (!rangeEnabled || questions.length === 0) {
        return {
            startIdx: 0,
            endIdx: questions.length - 1,
            startNum: questions[0]?.number || 1,
            endNum: questions[questions.length - 1]?.number || 1
        };
    }

    // 找到範圍內的起始和結束索引
    const effectiveEnd = rangeEnd || questions[questions.length - 1].number;
    let startIdx = questions.findIndex(q => q.number >= rangeStart);
    let endIdx = questions.findIndex(q => q.number > effectiveEnd);

    if (startIdx === -1) startIdx = 0;
    if (endIdx === -1) endIdx = questions.length;
    endIdx = endIdx - 1;

    // 確保有效範圍
    if (startIdx > endIdx) {
        startIdx = 0;
        endIdx = questions.length - 1;
    }

    return {
        startIdx,
        endIdx,
        startNum: questions[startIdx]?.number || 1,
        endNum: questions[endIdx]?.number || 1
    };
}

/**
 * 取得有效的題目索引列表
 *
 * 套用所有篩選條件：閱讀範圍、僅顯示重要題目、僅複習錯題、題型過濾與關鍵字搜尋。
 * 導航按鈕、答題卡與跳題功能皆以此為單一事實來源，確保行為一致。
 */
function getValidIndices() {
    if (questions.length === 0) return [];

    const range = getValidRange();
    const keyword = searchKeyword.trim().toLowerCase();
    const indices = [];

    for (let i = range.startIdx; i <= range.endIdx; i++) {
        const q = questions[i];
        // 過濾1：僅顯示重要題目
        if (showImportantOnly && !q.isImportant) {
            continue;
        }
        // 過濾2：題型過濾
        if (!enabledQuestionTypes.includes(q.type)) {
            continue;
        }
        // 過濾3：僅複習答錯的題目
        if (wrongOnlyEnabled && answerState[q.number] !== 'wrong') {
            continue;
        }
        // 過濾4：關鍵字搜尋（題號、題幹中英文與選項內容）
        if (keyword && !matchesKeyword(q, keyword)) {
            continue;
        }
        indices.push(i);
    }

    return indices;
}

/**
 * 判斷題目是否符合搜尋關鍵字
 * @param {Object} question - 題目物件
 * @param {string} keyword - 已轉為小寫的關鍵字
 * @returns {boolean}
 */
function matchesKeyword(question, keyword) {
    if (String(question.number) === keyword) return true;

    const haystack = [
        question.englishText,
        question.chineseText,
        question.shortAnswer,
        ...question.options.map(opt => opt.text)
    ].filter(Boolean).join('\n').toLowerCase();

    return haystack.includes(keyword);
}

/**
 * 上一題
 */
function prevQuestion() {
    const validIndices = getValidIndices();
    if (validIndices.length === 0) return;

    // 找到當前索引在有效索引列表中的位置
    const currentPos = validIndices.indexOf(currentIndex);

    if (currentPos === -1) {
        // 當前不在有效範圍內，跳到最後一個有效題目
        currentIndex = validIndices[validIndices.length - 1];
    } else if (currentPos > 0) {
        // 跳到前一個有效題目
        currentIndex = validIndices[currentPos - 1];
    }
    // 如果已經是第一題，不做任何動作

    renderQuestion();
}

/**
 * 下一題
 */
function nextQuestion() {
    const validIndices = getValidIndices();
    if (validIndices.length === 0) return;

    // 找到當前索引在有效索引列表中的位置
    const currentPos = validIndices.indexOf(currentIndex);

    // 如果啟用隨機跳題
    if (randomJumpEnabled) {
        const nextIdx = getRandomNextIndex();
        if (nextIdx !== -1) {
            currentIndex = nextIdx;
            renderQuestion();
        }
        // 如果沒有可跳題目，不做任何動作
        return;
    }

    if (currentPos === -1) {
        // 當前不在有效範圍內，跳到第一個有效題目
        currentIndex = validIndices[0];
    } else if (currentPos < validIndices.length - 1) {
        // 跳到下一個有效題目
        currentIndex = validIndices[currentPos + 1];
    }
    // 如果已經是最後一題，不做任何動作

    renderQuestion();
}

/**
 * 隨機跳題 - 獲取下一個未作答題目的索引
 */
function getRandomNextIndex() {
    const validIndices = getValidIndices();
    const unanswered = [];

    for (const i of validIndices) {
        const q = questions[i];
        if (!answerState[q.number]) {
            unanswered.push(i);
        }
    }

    if (unanswered.length === 0) return -1;
    return unanswered[Math.floor(Math.random() * unanswered.length)];
}

/**
 * 快速跳題
 */
function jumpToQuestion() {
    const input = document.getElementById('jumpInput');
    const num = parseInt(input.value, 10);

    if (Number.isNaN(num)) {
        showToast('請輸入要跳轉的題號', 'warn');
        return;
    }

    // 尋找對應題號的索引
    const index = questions.findIndex(q => q.number === num);
    if (index === -1) {
        showToast(`找不到第 ${num} 題`, 'error');
        return;
    }

    // 統一由 getValidIndices 判斷，避免各處篩選規則不一致
    if (!getValidIndices().includes(index)) {
        showToast(`第 ${num} 題不在目前的篩選範圍內（${describeActiveFilters()}）`, 'warn');
        return;
    }

    currentIndex = index;
    renderQuestion();
}

/**
 * 描述目前啟用的篩選條件，用於提示訊息
 * @returns {string}
 */
function describeActiveFilters() {
    const parts = [];
    if (rangeEnabled) {
        const range = getValidRange();
        parts.push(`範圍第 ${range.startNum}~${range.endNum} 題`);
    }
    if (showImportantOnly) parts.push('僅重要題目');
    if (wrongOnlyEnabled) parts.push('僅錯題');
    if (enabledQuestionTypes.length < 3) parts.push(`題型：${enabledQuestionTypes.join('、')}`);
    if (searchKeyword.trim()) parts.push(`搜尋「${searchKeyword.trim()}」`);
    return parts.length ? parts.join('、') : '無啟用的篩選';
}

/**
 * 更新跳題輸入框最大值
 */
function updateJumpInputMax() {
    const input = document.getElementById('jumpInput');
    if (questions.length > 0) {
        input.max = questions[questions.length - 1].number;
    }
}

// ==================== 翻譯切換 ====================
function toggleTranslation() {
    showChinese = !showChinese;
    // 僅重繪當前題目，不重置倒數計時
    renderQuestion({ restartTimer: false });
}

// ==================== 統計功能 ====================
function updateStats() {
    let correct = 0;
    let wrong = 0;

    // 僅統計目前題庫實際存在的題號，避免殘留紀錄造成數字失真
    for (const q of questions) {
        const state = answerState[q.number];
        if (state === 'correct') correct++;
        else if (state === 'wrong') wrong++;
    }

    const total = correct + wrong;
    const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;

    document.getElementById('correctCount').textContent = correct;
    document.getElementById('wrongCount').textContent = wrong;
    document.getElementById('accuracy').textContent = accuracy + '%';

    // 計算可作答題數（不含簡答題）
    const answerableQuestions = questions.filter(q => !q.isShortAnswer).length;
    const shortAnswerCount = questions.length - answerableQuestions;

    // 更新進度條（簡答題不計入）
    const progressPercent = answerableQuestions > 0 ? (total / answerableQuestions) * 100 : 0;
    document.getElementById('progressBar').style.width = progressPercent + '%';

    // 進度文字顯示（如有簡答題則標註）
    let progressText = `已作答 ${total} / ${answerableQuestions} 題`;
    if (shortAnswerCount > 0) {
        progressText += ` (另有 ${shortAnswerCount} 題簡答)`;
    }
    document.getElementById('progressText').textContent = progressText;
}

// ==================== 進度儲存 ====================
/**
 * 取得目前題庫的 localStorage 鍵名
 *
 * 以題庫識別碼作為命名空間，讓不同題庫的作答進度互不干擾。
 * @param {string} key - 欄位名稱
 * @returns {string} 完整鍵名
 */
function progressKey(key) {
    return `quiz_${bankId}_${key}`;
}

function saveProgress() {
    try {
        localStorage.setItem(progressKey('answerState'), JSON.stringify(answerState));
        localStorage.setItem(progressKey('userAnswers'), JSON.stringify(userAnswers));
        localStorage.setItem(progressKey('currentIndex'), currentIndex.toString());
    } catch (e) {
        console.warn('儲存進度失敗（可能已達儲存空間上限）', e);
    }
}

function loadSavedProgress() {
    answerState = {};
    userAnswers = {};
    currentIndex = 0;

    try {
        const saved = localStorage.getItem(progressKey('answerState'));
        if (saved) answerState = JSON.parse(saved) || {};

        const savedAnswers = localStorage.getItem(progressKey('userAnswers'));
        if (savedAnswers) userAnswers = JSON.parse(savedAnswers) || {};

        const savedIndex = localStorage.getItem(progressKey('currentIndex'));
        if (savedIndex !== null) {
            const parsed = parseInt(savedIndex, 10);
            // 確保索引在有效範圍內
            currentIndex = (Number.isNaN(parsed) || parsed >= questions.length || parsed < 0) ? 0 : parsed;
        }
    } catch (e) {
        console.warn('載入進度失敗，改以全新進度開始', e);
        answerState = {};
        userAnswers = {};
        currentIndex = 0;
    }
}

function resetProgress() {
    if (!confirm('確定要重設所有答題進度嗎？')) return;

    answerState = {};
    userAnswers = {};
    currentIndex = 0;
    stopTimer();
    localStorage.removeItem(progressKey('answerState'));
    localStorage.removeItem(progressKey('userAnswers'));
    localStorage.removeItem(progressKey('currentIndex'));
    generateAnswerCard();
    renderQuestion();
    updateStats();
    showToast('已重設答題進度', 'success');
}

// ==================== 倒數計時器功能 ====================
/**
 * 啟動倒數計時器
 *
 * 以到期時間戳計算剩餘秒數，而非每秒遞減計數。
 * 瀏覽器在背景分頁會節流 setInterval，逐次遞減會造成累積誤差。
 * @param {number} seconds - 計時時間（秒）
 * @param {number|null} questionNum - 計時所屬題號
 */
function startTimer(seconds = 60, questionNum = null) {
    if (!timerEnabled) return;

    // 停止現有計時器
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerStartTime = seconds;
    timerDeadline = Date.now() + seconds * 1000;
    timerQuestionNum = questionNum;
    timeRemaining = seconds;
    updateTimerDisplay();

    const timerBar = document.getElementById('timerBar');
    if (timerBar) {
        timerBar.classList.remove('hidden');
    }

    // 每秒更新一次
    timerInterval = setInterval(() => {
        timeRemaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
        updateTimerDisplay();

        // 時間到期
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            handleTimerExpired();
        }
    }, 250);
}

/**
 * 更新計時器顯示
 */
function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    // 更新時間顯示
    const minutesEl = document.getElementById('timerMinutes');
    const secondsEl = document.getElementById('timerSeconds');
    const progressEl = document.getElementById('timerProgress');
    const timerBar = document.getElementById('timerBar');

    if (minutesEl) {
        minutesEl.textContent = String(minutes).padStart(2, '0');
    }
    if (secondsEl) {
        secondsEl.textContent = String(seconds).padStart(2, '0');
    }

    // 更新進度條
    if (progressEl && timerStartTime > 0) {
        const progressPercent = (timeRemaining / timerStartTime) * 100;
        progressEl.style.width = progressPercent + '%';
    }

    // 當時間少於 10 秒時，變更顏色為紅色並加速脈衝
    if (timerBar) {
        if (timeRemaining <= 10) {
            timerBar.classList.add('timer-warning');
        } else {
            timerBar.classList.remove('timer-warning');
        }
    }
}

/**
 * 停止計時器
 */
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerQuestionNum = null;

    const timerBar = document.getElementById('timerBar');
    if (timerBar) {
        timerBar.classList.add('hidden');
    }
}

/**
 * 處理計時器到期（震動效果）
 */
function handleTimerExpired() {
    // 原以 class 選擇器取用題目卡片，但 Tailwind 的 `bg-slate-800/50` 含有
    // 未跳脫的斜線，屬於非法 CSS 選擇器，querySelector 會直接拋出例外，
    // 導致後續的震動與逾時提示全數失效。改以穩定的 id 取得元素。
    const questionCard = document.getElementById('questionCard');

    if (questionCard) {
        // 添加震動 CSS 動畫類別
        questionCard.classList.add('timer-shake');

        // 觸發振動 API（行動裝置）
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 100]); // 震動模式
        }

        // 3 秒後移除動畫類別
        setTimeout(() => {
            questionCard.classList.remove('timer-shake');
        }, 3000);
    }

    // 顯示超時提示（可選）
    const resultMessage = document.getElementById('resultMessage');
    if (resultMessage && !hasAnswered) {
        resultMessage.className = 'block mt-6 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/50';
        resultMessage.innerHTML = '<strong>⏰ 時間已到！</strong><br>未在規定時間內作答';
        resultMessage.classList.remove('hidden');
    }
}

// ==================== 工具函式 ====================
/**
 * HTML 轉義
 */
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 顯示非阻塞式提示訊息
 *
 * 取代會中斷操作的 alert()，訊息會在數秒後自動消失。
 * @param {string} message - 訊息內容
 * @param {'info'|'success'|'warn'|'error'} [type='info'] - 訊息類型
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.log(message);
        return;
    }

    const styles = {
        info: 'bg-slate-800 border-slate-600 text-slate-100',
        success: 'bg-green-600/90 border-green-400 text-white',
        warn: 'bg-amber-600/90 border-amber-400 text-white',
        error: 'bg-red-600/90 border-red-400 text-white'
    };

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto px-4 py-2.5 rounded-lg border shadow-lg text-sm max-w-[90vw] ` +
        `transition-opacity duration-300 ${styles[type] || styles.info}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 2600);
}

/**
 * 處理 Markdown 反引號關鍵字高亮
 * 將 `關鍵字` 轉換為紅色顯示
 * @param {string} text - 原始文字
 * @returns {string} 處理後的 HTML
 */
function highlightKeywords(text) {
    // 先轉義 HTML 特殊字元
    const escaped = escapeHtml(text);

    // 如果關鍵字高亮功能已停用，只移除反引號但不套用樣式
    if (!keywordHighlightEnabled) {
        return escaped.replace(/`([^`]+)`/g, '$1');
    }

    // 將反引號包裹的文字轉換為紅色 span
    // 支援多個關鍵字：`keyword1` 和 `keyword2` 等
    return escaped.replace(/`([^`]+)`/g, '<span class="text-red-400 font-semibold">$1</span>');
}

// ==================== 解析面板控制（懸浮視窗） ====================
let isExplanationPanelOpen = false;
let explanationPanelDragging = false;
let explanationPanelOffsetX = 0;
let explanationPanelOffsetY = 0;

/**
 * 初始化懸浮解析視窗拖曳功能
 */
function initExplanationPanelDrag() {
    const panel = document.getElementById('explanationPanel');
    const header = document.getElementById('explanationPanelHeader');

    // 桌面版滑鼠拖曳
    header.addEventListener('mousedown', startExplanationPanelDrag);
    document.addEventListener('mousemove', dragExplanationPanel);
    document.addEventListener('mouseup', stopExplanationPanelDrag);

    // 手機版不啟用拖曳（全螢幕模式不需要）
    // 只在桌面版啟用觸控拖曳
    if (window.innerWidth > 768) {
        header.addEventListener('touchstart', startExplanationPanelDragTouch, { passive: false });
        document.addEventListener('touchmove', dragExplanationPanelTouch, { passive: false });
        document.addEventListener('touchend', stopExplanationPanelDrag);
    }
}

function startExplanationPanelDrag(e) {
    // 手機版不允許拖曳
    if (window.innerWidth <= 768) return;

    // 如果點擊的是關閉按鈕，不啟動拖曳
    if (e.target.closest('button')) return;

    const panel = document.getElementById('explanationPanel');
    explanationPanelDragging = true;
    explanationPanelOffsetX = e.clientX - panel.offsetLeft;
    explanationPanelOffsetY = e.clientY - panel.offsetTop;
    panel.style.transition = 'none';
}

function startExplanationPanelDragTouch(e) {
    // 手機版不允許拖曳
    if (window.innerWidth <= 768) return;

    // 如果點擊的是關閉按鈕，不啟動拖曳
    if (e.target.closest('button')) return;

    e.preventDefault();
    const touch = e.touches[0];
    const panel = document.getElementById('explanationPanel');
    explanationPanelDragging = true;
    explanationPanelOffsetX = touch.clientX - panel.offsetLeft;
    explanationPanelOffsetY = touch.clientY - panel.offsetTop;
    panel.style.transition = 'none';
}

function dragExplanationPanel(e) {
    if (!explanationPanelDragging) return;
    e.preventDefault();
    const panel = document.getElementById('explanationPanel');
    let newX = e.clientX - explanationPanelOffsetX;
    let newY = e.clientY - explanationPanelOffsetY;

    // 限制在視窗範圍內
    newX = Math.max(0, Math.min(newX, window.innerWidth - 320));
    newY = Math.max(0, Math.min(newY, window.innerHeight - 200));

    panel.style.left = newX + 'px';
    panel.style.top = newY + 'px';
}

function dragExplanationPanelTouch(e) {
    if (!explanationPanelDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const panel = document.getElementById('explanationPanel');
    let newX = touch.clientX - explanationPanelOffsetX;
    let newY = touch.clientY - explanationPanelOffsetY;

    // 限制在視窗範圍內
    newX = Math.max(0, Math.min(newX, window.innerWidth - 320));
    newY = Math.max(0, Math.min(newY, window.innerHeight - 200));

    panel.style.left = newX + 'px';
    panel.style.top = newY + 'px';
}

function stopExplanationPanelDrag() {
    if (explanationPanelDragging) {
        const panel = document.getElementById('explanationPanel');
        panel.style.transition = '';
        explanationPanelDragging = false;
    }
}

/**
 * 開啟解析面板
 */
function toggleExplanationPanel() {
    if (isExplanationPanelOpen) {
        closeExplanationPanel();
    } else {
        openExplanationPanel();
    }
}

function openExplanationPanel() {
    const q = questions[currentIndex];
    if (!q.explanation) return;

    const panel = document.getElementById('explanationPanel');
    const content = document.getElementById('explanationContent');

    // 渲染 Markdown 解析
    content.innerHTML = marked.parse(q.explanation);
    document.getElementById('explanationQuestionNum').textContent = `第 ${q.number} 題`;

    panel.classList.remove('hidden');
    isExplanationPanelOpen = true;

    // ESC 鍵關閉
    document.addEventListener('keydown', closeExplanationPanelOnEsc);
}

function closeExplanationPanel() {
    const panel = document.getElementById('explanationPanel');
    panel.classList.add('hidden');
    isExplanationPanelOpen = false;
    document.removeEventListener('keydown', closeExplanationPanelOnEsc);
}

function closeExplanationPanelOnEsc(e) {
    if (e.key === 'Escape') {
        closeExplanationPanel();
    }
}

// ==================== 圖片 Dialog ====================
let imageZoom = 1;
let imageDragging = false;
let imageDragStartX = 0;
let imageDragStartY = 0;
let imageCurrentX = 0;
let imageCurrentY = 0;

function openImageDialog() {
    imageZoom = 1;
    imageCurrentX = 0;
    imageCurrentY = 0;
    document.getElementById('imageDialog').classList.remove('hidden');
}

function closeImageDialog() {
    document.getElementById('imageDialog').classList.add('hidden');
}

function handleDialogBackdropClick(event) {
    if (event.target.id === 'imageDialog') {
        closeImageDialog();
    }
}

function updateImageTransform(smooth = true) {
    const imageWrapper = document.getElementById('imageWrapper');
    if (smooth) {
        imageWrapper.style.transition = 'transform 0.3s ease';
    } else {
        imageWrapper.style.transition = 'none';
    }
    imageWrapper.style.transform = `scale(${imageZoom}) translate(${imageCurrentX}px, ${imageCurrentY}px)`;
}

function zoomIn() {
    imageZoom = Math.min(imageZoom + 0.2, 3);
    updateImageTransform();
}

function zoomOut() {
    imageZoom = Math.max(imageZoom - 0.2, 1);
    if (imageZoom === 1) {
        imageCurrentX = 0;
        imageCurrentY = 0;
    }
    updateImageTransform();
}

function resetZoom() {
    imageZoom = 1;
    imageCurrentX = 0;
    imageCurrentY = 0;
    updateImageTransform();
}

function handleWheel(event) {
    event.preventDefault();
    if (event.deltaY < 0) {
        zoomIn();
    } else {
        zoomOut();
    }
}

function startDrag(event) {
    if (imageZoom === 1) return;
    imageDragging = true;
    imageDragStartX = event.clientX;
    imageDragStartY = event.clientY;
}

function onDrag(event) {
    if (!imageDragging) return;
    const deltaX = (event.clientX - imageDragStartX) / imageZoom;
    const deltaY = (event.clientY - imageDragStartY) / imageZoom;
    imageCurrentX += deltaX;
    imageCurrentY += deltaY;
    imageDragStartX = event.clientX;
    imageDragStartY = event.clientY;
    updateImageTransform(false);
}

function endDrag() {
    imageDragging = false;
}

// ==================== 設定 Dialog ====================
function openSettingsDialog() {
    const input = document.getElementById('groqApiKeyInput');
    if (groqApiKey) {
        input.value = groqApiKey;
    }
    document.getElementById('settingsDialog').classList.remove('hidden');
    document.getElementById('modelSelectContainer').classList.add('hidden');
    document.getElementById('advancedSettingsContainer').classList.add('hidden');
}

function closeSettingsDialog() {
    document.getElementById('settingsDialog').classList.add('hidden');
}

function handleSettingsBackdropClick(event) {
    if (event.target.id === 'settingsDialog') {
        closeSettingsDialog();
    }
}

async function verifyApiKey() {
    const input = document.getElementById('groqApiKeyInput');
    const key = input.value.trim();

    if (!key) {
        showToast('請輸入 GROQ API Key', 'warn');
        return;
    }

    const btn = document.getElementById('verifyApiKeyBtn');
    const spinner = document.getElementById('verifySpinner');
    const status = document.getElementById('apiKeyStatus');

    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
        // 測試 API Key
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${key}` }
        });

        if (response.ok) {
            const data = await response.json();
            availableModels = data.data.map(m => m.id);
            groqApiKey = key;
            localStorage.setItem('groq_api_key', key);

            // 顯示模型選擇
            document.getElementById('modelSelectContainer').classList.remove('hidden');
            document.getElementById('advancedSettingsContainer').classList.remove('hidden');
            status.textContent = '✓ API Key 驗證成功';
            status.className = 'mt-2 text-xs text-green-400';

            // 填充模型列表
            populateModelDropdown();
        } else {
            status.textContent = '✗ API Key 無效';
            status.className = 'mt-2 text-xs text-red-400';
        }
    } catch (e) {
        status.textContent = '✗ 無法連接到 GROQ API';
        status.className = 'mt-2 text-xs text-red-400';
    }

    spinner.classList.add('hidden');
    btn.disabled = false;
}

function populateModelDropdown() {
    renderModelOptions(
        availableModels.filter(m => m.includes('mixtral') || m.includes('gpt') || m.includes('llama'))
    );
}

/**
 * 渲染模型下拉選單
 *
 * 以 dataset 傳遞模型名稱並用事件委派處理點擊，
 * 避免將未轉義的模型 id 直接內插進 onclick 字串。
 * @param {string[]} models - 模型名稱列表
 */
function renderModelOptions(models) {
    const dropdown = document.getElementById('modelDropdown');
    if (!dropdown) return;

    dropdown.innerHTML = models
        .map(m => `<div class="px-4 py-2 hover:bg-slate-700 cursor-pointer text-sm" data-model="${escapeHtml(m)}">${escapeHtml(m)}</div>`)
        .join('');

    if (!dropdown.dataset.bound) {
        dropdown.addEventListener('click', (e) => {
            const item = e.target.closest('[data-model]');
            if (item) selectModel(item.dataset.model);
        });
        dropdown.dataset.bound = 'true';
    }
}

function selectModel(modelId) {
    groqModel = modelId;
    document.getElementById('currentModelName').textContent = modelId;
    document.getElementById('modelSearchInput').value = '';
    document.getElementById('modelDropdown').classList.add('hidden');
}

function showModelDropdown() {
    const dropdown = document.getElementById('modelDropdown');
    dropdown.classList.toggle('hidden');
}

function filterModels() {
    const input = document.getElementById('modelSearchInput').value.toLowerCase();
    renderModelOptions(availableModels.filter(m => m.toLowerCase().includes(input)));
}

function toggleAdvancedSettings() {
    const content = document.getElementById('advancedSettingsContent');
    const icon = document.getElementById('advancedSettingsIcon');
    const isHidden = content.classList.contains('hidden');

    if (isHidden) {
        content.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}

function loadSystemPrompt() {
    document.getElementById('customPromptInput').value = AI_SYSTEM_PROMPT;
}

function resetCustomPrompt() {
    document.getElementById('customPromptInput').value = '';
}

function saveSettings() {
    if (!groqApiKey) {
        showToast('請先輸入並驗證 API Key', 'warn');
        return;
    }

    let customPrompt = document.getElementById('customPromptInput').value.trim();

    // 如果內容等於系統預設提示詞，儲存為空（表示使用系統預設）
    if (customPrompt === AI_SYSTEM_PROMPT.trim()) {
        customPrompt = '';
    }

    localStorage.setItem('groq_api_key', groqApiKey);
    localStorage.setItem('groq_model', groqModel);
    localStorage.setItem('groq_custom_prompt', customPrompt);

    closeSettingsDialog();
}

// ==================== 進階設定 Dialog ====================
/**
 * 設定核取方塊的勾選狀態
 *
 * 以容錯方式存取，避免任何一個元素缺失就中斷整個對話框的狀態同步。
 * @param {string} id - 元素 id
 * @param {boolean} checked - 勾選狀態
 */
function setCheckbox(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
}

function openAdvancedSettingsDialog() {
    document.getElementById('advancedSettingsDialog').classList.remove('hidden');

    // 載入已保存的設定
    setCheckbox('rangeEnabledCheckbox', rangeEnabled);
    setCheckbox('showImportantOnlyCheckbox', showImportantOnly);
    setCheckbox('wrongOnlyCheckbox', wrongOnlyEnabled);
    setCheckbox('randomJumpCheckbox', randomJumpEnabled);
    setCheckbox('keywordHighlightCheckbox', keywordHighlightEnabled);

    if (rangeEnabled) {
        document.getElementById('rangeInputContainer')?.classList.remove('hidden');
        const startInput = document.getElementById('rangeStartInput');
        const endInput = document.getElementById('rangeEndInput');
        if (startInput) startInput.value = rangeStart;
        if (endInput) endInput.value = rangeEnd || '';
        updateRangeInfo();
    }

    if (showImportantOnly) {
        document.getElementById('showImportantOnlyInfo')?.classList.remove('hidden');
        updateImportantOnlyInfo();
    }

    if (wrongOnlyEnabled) {
        document.getElementById('wrongOnlyInfo')?.classList.remove('hidden');
    }
    updateWrongOnlyInfo();

    if (randomJumpEnabled) {
        document.getElementById('randomJumpInfo')?.classList.remove('hidden');
    }

    // 初始化題型過濾設定
    updateQuestionTypeCheckboxes();
    updateTypeFilterInfo();
}

function closeAdvancedSettingsDialog() {
    document.getElementById('advancedSettingsDialog').classList.add('hidden');
}

function handleAdvancedSettingsBackdropClick(event) {
    if (event.target.id === 'advancedSettingsDialog') {
        closeAdvancedSettingsDialog();
    }
}

function toggleRangeEnabled() {
    rangeEnabled = document.getElementById('rangeEnabledCheckbox').checked;
    const container = document.getElementById('rangeInputContainer');

    if (rangeEnabled) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }

    localStorage.setItem('range_enabled', rangeEnabled);
    updateJumpInputMax();

    // 如果僅顯示重要題目已啟用，更新其信息
    if (showImportantOnly) {
        updateImportantOnlyInfo();
    }
    applyFilterChange();
}

function toggleRandomJump() {
    randomJumpEnabled = document.getElementById('randomJumpCheckbox').checked;
    const info = document.getElementById('randomJumpInfo');

    if (randomJumpEnabled) {
        info.classList.remove('hidden');
    } else {
        info.classList.add('hidden');
    }

    localStorage.setItem('random_jump_enabled', randomJumpEnabled);
}

function toggleKeywordHighlight() {
    keywordHighlightEnabled = document.getElementById('keywordHighlightCheckbox').checked;
    localStorage.setItem('keyword_highlight_enabled', keywordHighlightEnabled);

    // 重新渲染題目以套用新的設定（不重置倒數計時）
    if (questions.length > 0) {
        renderQuestion({ restartTimer: false });
    }
}

/**
 * 切換「僅複習答錯題目」模式
 */
function toggleWrongOnly() {
    wrongOnlyEnabled = document.getElementById('wrongOnlyCheckbox').checked;
    const info = document.getElementById('wrongOnlyInfo');

    if (info) info.classList.toggle('hidden', !wrongOnlyEnabled);

    localStorage.setItem('wrong_only_enabled', wrongOnlyEnabled);
    updateWrongOnlyInfo();
    applyFilterChange();
}

/**
 * 更新錯題複習模式的資訊文字
 */
function updateWrongOnlyInfo() {
    const infoText = document.getElementById('wrongOnlyInfoText');
    if (!infoText || questions.length === 0) return;

    const wrongCount = questions.filter(q => answerState[q.number] === 'wrong').length;
    infoText.textContent = wrongCount > 0
        ? `目前共有 ${wrongCount} 題答錯的題目`
        : '目前沒有答錯的題目';
}

/**
 * 執行關鍵字搜尋
 */
function applySearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    searchKeyword = input.value;
    updateSearchInfo();
    applyFilterChange();
}

/**
 * 清除關鍵字搜尋
 */
function clearSearch() {
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    searchKeyword = '';
    updateSearchInfo();
    applyFilterChange();
}

/**
 * 更新搜尋結果的資訊文字
 */
function updateSearchInfo() {
    const infoText = document.getElementById('searchInfoText');
    if (!infoText) return;

    if (!searchKeyword.trim()) {
        infoText.classList.add('hidden');
        return;
    }

    infoText.classList.remove('hidden');
    const count = getValidIndices().length;
    infoText.textContent = count > 0
        ? `找到 ${count} 題符合「${searchKeyword.trim()}」`
        : `沒有題目符合「${searchKeyword.trim()}」`;
}

/**
 * 篩選條件變更後的共用處理
 *
 * 同步答題卡的可用狀態，並在目前題目被篩掉時跳到第一個有效題目。
 */
function applyFilterChange() {
    if (questions.length === 0) return;

    refreshAnswerCardAvailability();
    updateTypeFilterInfo();

    const validIndices = getValidIndices();
    if (validIndices.length === 0) {
        showToast('目前的篩選條件沒有符合的題目', 'warn');
        return;
    }

    if (!validIndices.includes(currentIndex)) {
        currentIndex = validIndices[0];
        renderQuestion();
    }
}

function toggleQuestionType(type) {
    const index = enabledQuestionTypes.indexOf(type);

    // 邊界檢查：至少保留一個題型
    if (index !== -1 && enabledQuestionTypes.length === 1) {
        showToast('至少需要選擇一種題型', 'warn');
        updateQuestionTypeCheckboxes();
        return;
    }

    // 切換題型啟用狀態
    if (index !== -1) {
        enabledQuestionTypes.splice(index, 1);
    } else {
        enabledQuestionTypes.push(type);
    }

    // 保存到 localStorage
    localStorage.setItem('enabled_question_types', JSON.stringify(enabledQuestionTypes));

    // 更新信息顯示
    updateQuestionTypeCheckboxes();
    applyFilterChange();
}

function updateTypeFilterInfo() {
    const typeFilterInfoText = document.getElementById('typeFilterInfoText');
    if (!typeFilterInfoText) return;

    const validIndices = getValidIndices();
    const typeNames = enabledQuestionTypes.join('、');

    if (validIndices.length === 0) {
        typeFilterInfoText.textContent = `已選題型：${typeNames}（無符合的題目）`;
    } else {
        typeFilterInfoText.textContent = `已選題型：${typeNames}（${validIndices.length} 題）`;
    }
}

function updateQuestionTypeCheckboxes() {
    const singleChoiceCheckbox = document.getElementById('singleChoiceCheckbox');
    const multipleChoiceCheckbox = document.getElementById('multipleChoiceCheckbox');
    const shortAnswerCheckbox = document.getElementById('shortAnswerCheckbox');

    if (singleChoiceCheckbox) singleChoiceCheckbox.checked = enabledQuestionTypes.includes('單選題');
    if (multipleChoiceCheckbox) multipleChoiceCheckbox.checked = enabledQuestionTypes.includes('多選題');
    if (shortAnswerCheckbox) shortAnswerCheckbox.checked = enabledQuestionTypes.includes('簡答題');
}

function toggleShowImportantOnly() {
    showImportantOnly = document.getElementById('showImportantOnlyCheckbox').checked;
    const info = document.getElementById('showImportantOnlyInfo');

    if (showImportantOnly) {
        info.classList.remove('hidden');
        // 更新信息顯示
        updateImportantOnlyInfo();
    } else {
        info.classList.add('hidden');
    }

    localStorage.setItem('show_important_only', showImportantOnly);
    applyFilterChange();
}

/**
 * 更新僅顯示重要題目的信息文字
 */
function updateImportantOnlyInfo() {
    const infoText = document.getElementById('importantOnlyInfoText');
    if (!infoText || questions.length === 0) return;

    const validIndices = getValidIndices();
    const importantCount = validIndices.length;

    if (rangeEnabled) {
        const range = getValidRange();
        infoText.textContent = `範圍內共 ${importantCount} 題重要題目（第 ${range.startNum} ~ ${range.endNum} 題）`;
    } else {
        infoText.textContent = `共 ${importantCount} 題重要題目`;
    }
}

function updateRangeSettings() {
    const startInput = document.getElementById('rangeStartInput');
    const endInput = document.getElementById('rangeEndInput');

    rangeStart = parseInt(startInput.value) || 1;
    rangeEnd = endInput.value ? parseInt(endInput.value) : null;

    localStorage.setItem('range_start', rangeStart);
    localStorage.setItem('range_end', rangeEnd || '');

    updateRangeInfo();
    updateJumpInputMax();

    // 如果僅顯示重要題目已啟用，更新其信息
    if (showImportantOnly) {
        updateImportantOnlyInfo();
    }
    applyFilterChange();
}

function updateRangeInfo() {
    const range = getValidRange();
    document.getElementById('rangeInfoText').textContent =
        `目前範圍：第 ${range.startNum} 題 ~ 第 ${range.endNum} 題（共 ${range.endIdx - range.startIdx + 1} 題）`;
}

function resetRange() {
    rangeEnabled = false;
    rangeStart = 1;
    rangeEnd = null;
    document.getElementById('rangeEnabledCheckbox').checked = false;
    document.getElementById('rangeInputContainer').classList.add('hidden');
    localStorage.setItem('range_enabled', 'false');
    localStorage.removeItem('range_start');
    localStorage.removeItem('range_end');
    updateJumpInputMax();
    applyFilterChange();
}

// ==================== 手機版互動功能 ====================

/**
 * 開啟手機版選單
 */
function openMobileMenu() {
    const panel = document.getElementById('mobileMenuPanel');
    if (panel) {
        panel.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * 關閉手機版選單
 */
function closeMobileMenu() {
    const panel = document.getElementById('mobileMenuPanel');
    if (panel) {
        panel.classList.remove('open');
        document.body.style.overflow = '';
    }
}

/**
 * 切換統計面板顯示（手機版）
 */
function toggleStatsPanel() {
    const panel = document.getElementById('statsPanel');
    const toggleBtn = document.getElementById('statsToggleBtn');
    const toggleIcon = document.getElementById('statsToggleIcon');

    if (panel && toggleBtn) {
        const isOpen = panel.classList.contains('open');

        if (isOpen) {
            panel.classList.remove('open');
            toggleBtn.classList.remove('open');
            // 恢復統計圖示
            if (toggleIcon) {
                toggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>';
            }
        } else {
            panel.classList.add('open');
            toggleBtn.classList.add('open');
            // 變成關閉圖示
            if (toggleIcon) {
                toggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>';
            }
        }
    }
}

/**
 * 檢測是否為手機裝置
 */
function isMobile() {
    return window.innerWidth <= 1024;
}

/**
 * 處理視窗大小變化
 */
function handleResize() {
    const statsPanel = document.getElementById('statsPanel');
    const statsToggleBtn = document.getElementById('statsToggleBtn');

    if (isMobile()) {
        // 手機版：確保面板初始為關閉
        if (statsToggleBtn) statsToggleBtn.style.display = 'flex';
    } else {
        // 桌面版：確保面板正常顯示
        if (statsPanel) statsPanel.classList.remove('open');
        if (statsToggleBtn) {
            statsToggleBtn.style.display = 'none';
            statsToggleBtn.classList.remove('open');
        }
    }
}

// ==================== 鍵盤快捷鍵 ====================
/**
 * 判斷目前焦點是否位於輸入元件
 *
 * 避免在輸入框內按方向鍵時同時觸發換題。
 * @returns {boolean}
 */
function isTypingContext(target) {
    if (!target) return false;
    return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
}

/**
 * 判斷是否有對話框或面板處於開啟狀態
 * @returns {boolean}
 */
function isOverlayOpen() {
    const overlayIds = ['imageDialog', 'settingsDialog', 'advancedSettingsDialog'];
    if (overlayIds.some(id => !document.getElementById(id)?.classList.contains('hidden'))) return true;
    if (isExplanationPanelOpen) return true;
    return !!document.getElementById('mobileMenuPanel')?.classList.contains('open');
}

document.addEventListener('keydown', (e) => {
    if (!questions || questions.length === 0) return;
    // 輸入中或有覆蓋層開啟時不攔截按鍵
    if (isTypingContext(e.target) || isOverlayOpen()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // 方向鍵導航
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        nextQuestion();
        return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        prevQuestion();
        return;
    }

    const q = questions[currentIndex];
    if (!q || q.isShortAnswer || hasAnswered) return;

    // A~F 或 1~6 直接選擇對應選項
    const letter = resolveOptionKey(e.key, q);
    if (letter) {
        e.preventDefault();
        if (q.isMultiple) {
            toggleOptionSelection(letter);
        } else {
            selectSingleOption(letter, q);
        }
        return;
    }

    // 多選題以 Enter 送出
    if (e.key === 'Enter' && q.isMultiple && selectedOptions.length > 0) {
        e.preventDefault();
        submitMultipleChoice();
    }
});

/**
 * 將按鍵轉換為選項代號
 * @param {string} key - 按下的鍵
 * @param {Object} question - 當前題目
 * @returns {string|null} 選項代號，無對應時回傳 null
 */
function resolveOptionKey(key, question) {
    const letters = question.options.map(opt => opt.letter);

    const upper = key.toUpperCase();
    if (letters.includes(upper)) return upper;

    // 數字鍵對應第 N 個選項
    if (/^[1-9]$/.test(key)) {
        const index = parseInt(key, 10) - 1;
        if (index < letters.length) return letters[index];
    }
    return null;
}

/**
 * 切換多選題某個選項的勾選狀態（供鍵盤操作使用）
 * @param {string} letter - 選項代號
 */
function toggleOptionSelection(letter) {
    const checkbox = document.querySelector(`#optionsContainer input[data-letter="${letter}"]`);
    if (!checkbox || checkbox.disabled) return;

    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change'));
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    // 載入已儲存的 GROQ 設定
    const savedKey = localStorage.getItem('groq_api_key');
    const savedModel = localStorage.getItem('groq_model');
    if (savedKey) groqApiKey = savedKey;
    if (savedModel) groqModel = savedModel;

    // 載入已儲存的進階設定
    const savedRandomJump = localStorage.getItem('random_jump_enabled');
    randomJumpEnabled = savedRandomJump === 'true';

    // 載入關鍵字高亮設定（預設為啟用）
    const savedKeywordHighlight = localStorage.getItem('keyword_highlight_enabled');
    keywordHighlightEnabled = savedKeywordHighlight !== 'false'; // 預設 true，只有明確設為 false 才停用

    // 載入閱讀範圍設定
    const savedRangeEnabled = localStorage.getItem('range_enabled');
    const savedRangeStart = localStorage.getItem('range_start');
    const savedRangeEnd = localStorage.getItem('range_end');
    rangeEnabled = savedRangeEnabled === 'true';
    rangeStart = savedRangeStart ? parseInt(savedRangeStart) : 1;
    rangeEnd = savedRangeEnd ? parseInt(savedRangeEnd) : null;

    // 載入僅顯示重要題目設定
    const savedShowImportantOnly = localStorage.getItem('show_important_only');
    showImportantOnly = savedShowImportantOnly === 'true';

    // 載入錯題複習設定
    wrongOnlyEnabled = localStorage.getItem('wrong_only_enabled') === 'true';

    // 載入題型過濾設定
    const savedQuestionTypes = localStorage.getItem('enabled_question_types');
    if (savedQuestionTypes) {
        try {
            enabledQuestionTypes = JSON.parse(savedQuestionTypes);
            if (!Array.isArray(enabledQuestionTypes) || enabledQuestionTypes.length === 0) {
                enabledQuestionTypes = ['單選題', '多選題', '簡答題'];
            }
        } catch (e) {
            enabledQuestionTypes = ['單選題', '多選題', '簡答題'];
        }
    }

    // 初始化懸浮解析視窗拖曳功能
    initExplanationPanelDrag();

    // 答題卡以事件委派處理點擊，避免為上千格逐一綁定事件
    document.getElementById('answerCard')?.addEventListener('click', handleAnswerCardClick);

    // 搜尋輸入即時過濾（輸入停止後才觸發，避免大題庫逐字重算）
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimer = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(applySearch, 250);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimer);
                applySearch();
            }
        });
    }

    // 初始化手機版功能
    handleResize();
    window.addEventListener('resize', handleResize);

    // 點擊手機選單外部關閉選單
    document.getElementById('mobileMenuPanel')?.addEventListener('click', (e) => {
        if (e.target.id === 'mobileMenuPanel') {
            closeMobileMenu();
        }
    });

    // ESC 鍵快捷功能
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // 優先關閉已開啟的面板
            const mobileMenuPanel = document.getElementById('mobileMenuPanel');
            const statsPanel = document.getElementById('statsPanel');

            // 依疊放順序關閉對話框
            const dialogs = [
                ['imageDialog', closeImageDialog],
                ['settingsDialog', closeSettingsDialog],
                ['advancedSettingsDialog', closeAdvancedSettingsDialog]
            ];
            for (const [id, close] of dialogs) {
                if (!document.getElementById(id)?.classList.contains('hidden')) {
                    close();
                    return;
                }
            }

            // 如果手機選單打開，關閉它
            if (mobileMenuPanel?.classList.contains('open')) {
                closeMobileMenu();
                return;
            }

            // 如果統計面板打開，關閉它
            if (statsPanel?.classList.contains('open')) {
                toggleStatsPanel();
                return;
            }

            // 如果解析面板打開，由 closeExplanationPanelOnEsc 處理
            if (isExplanationPanelOpen) {
                return;
            }

            // 沒有面板打開時，聚焦到跳題輸入框並清空
            const jumpInput = document.getElementById('jumpInput');
            if (jumpInput && questions.length > 0) {
                jumpInput.value = '';
                jumpInput.focus();
                jumpInput.select();
            }
        }
    });

    autoLoadQuestions();
});

// ==================== AI 解析功能 ====================
const AI_SYSTEM_PROMPT = `你是一個具備專業知識的考題解析專家，專門用於題庫練習與學習知識輔助。

你的任務是：
1. 仔細閱讀「題目內容」與「所有選項」
2. 僅根據題目條件與邏輯推論作答，不可憑空猜測
3. 明確選出一個最正確的答案
4. 提供清楚、結構化、可學習的解析說明
5. 全程使用「繁體中文」回覆

請嚴格依照以下輸出格式回答（不得省略段落標題）：

--------------------------------
正確答案：<請填入選項代號，例如 A / B / C / D>

解析：
<說明為何該選項符合題目條件，需具備邏輯推導與關鍵判斷依據>

題目條件關鍵：
1. <從題目中萃取的關鍵條件或限制>
2. <重要的技術名詞、規則、前提或情境>
（如有更多關鍵條件可自行補充）

各選項比較：
A. <選項內容簡述與判斷原因> ❌ / ✅
B. <選項內容簡述與判斷原因> ❌ / ✅
C. <選項內容簡述與判斷原因> ❌ / ✅
D. <選項內容簡述與判斷原因> ❌ / ✅

結論：
<總結分析，說明為何正確答案在所有選項中是最佳且最符合題意的選擇>
--------------------------------

補充規則：
- 若題目為單選題，只能有一個「正確答案」
- 若題目為多選題，需列出所有正確選項
- 若題目描述不足或有歧義，請以「最符合一般考試標準解釋」進行判斷
- 各選項說明請保持簡短、精準、可比較
- 不要加入與題目無關的延伸知識`;

/**
 * 使用 AI 分析當前題目
 */
async function analyzeWithAI() {
    // 檢查 API Key
    if (!groqApiKey) {
        const savedKey = localStorage.getItem('groq_api_key');
        if (savedKey) {
            groqApiKey = savedKey;
        } else {
            showToast('請先在設定中配置 GROQ API Key', 'warn');
            openSettingsDialog();
            return;
        }
    }

    // 載入已儲存的模型和自訂提示詞
    const savedModel = localStorage.getItem('groq_model');
    const savedPrompt = localStorage.getItem('groq_custom_prompt');
    if (savedModel) {
        groqModel = savedModel;
    }

    // 決定使用的提示詞
    let systemPrompt = AI_SYSTEM_PROMPT;
    if (savedPrompt && savedPrompt.trim() && savedPrompt.trim() !== '請使用系統原生提示詞') {
        systemPrompt = savedPrompt.trim();
    }

    // 取得當前題目
    const q = questions[currentIndex];
    if (!q) return;

    // 顯示區塊並設定載入狀態
    const section = document.getElementById('aiAnalysisSection');
    const loading = document.getElementById('aiAnalysisLoading');
    const content = document.getElementById('aiAnalysisContent');
    const error = document.getElementById('aiAnalysisError');

    section.classList.remove('hidden');
    loading.classList.remove('hidden');
    content.classList.add('hidden');
    error.classList.add('hidden');

    // 滾動到 AI 解析區塊
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 組合題目內容（根據題型調整格式）
    let userPrompt = `題目類型：${q.type}

題目：
${q.englishText}

${q.chineseText ? `中文翻譯：\n${q.chineseText}\n` : ''}`;

    if (q.isShortAnswer) {
        // 簡答題格式
        userPrompt += `\n這是一道簡答題，請協助分析題目並提供詳細的解答思路。`;
        if (q.shortAnswer) {
            userPrompt += `\n\n參考答案：\n${q.shortAnswer}`;
        }
    } else {
        // 選擇題格式
        const optionsText = q.options.map(opt => `${opt.letter}. ${opt.text}`).join('\n');
        userPrompt += `選項：\n${optionsText}`;
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: groqModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API 請求失敗 (${response.status})`);
        }

        const data = await response.json();
        const result = data.choices[0]?.message?.content || '無法取得回應';

        // 顯示結果
        loading.classList.add('hidden');
        content.classList.remove('hidden');
        content.innerHTML = formatAiResponse(result);

    } catch (err) {
        console.error('AI 分析錯誤:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        document.getElementById('aiAnalysisErrorMsg').textContent = err.message;
    }
}

/**
 * 隱藏 AI 解析區塊
 */
function hideAiAnalysis() {
    document.getElementById('aiAnalysisSection').classList.add('hidden');
}

/**
 * 格式化 AI 回應（簡易 Markdown 轉 HTML）
 */
function formatAiResponse(text) {
    // 移除開頭的分隔線
    let processed = text.replace(/^-{3,}\s*\n?/gm, '').trim();

    // 先轉義 HTML
    processed = processed
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 按行處理
    const lines = processed.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 跳過空行和分隔線
        if (!line || /^-{3,}$/.test(line)) {
            if (line && result.length > 0) {
                result.push('<div class="h-2"></div>');
            }
            continue;
        }

        // 正確答案（優先匹配）
        if (/^正確答案[：:]/.test(line)) {
            const match = line.match(/正確答案[：:]\s*(.+)/);
            if (match) {
                result.push(`<div class="bg-green-500/10 border-l-4 border-green-500 px-4 py-3 rounded-r-lg mb-4"><div class="text-lg font-bold text-green-400 mb-1">✓ 正確答案</div><div class="text-2xl font-bold text-green-300 tracking-wider">${match[1]}</div></div>`);
            }
            continue;
        }

        // 段落標題
        if (/^(解析|題目條件關鍵|各選項比較|結論)[：:]/.test(line)) {
            const match = line.match(/^(解析|題目條件關鍵|各選項比較|結論)[：:]/);
            if (match) {
                result.push(`<div class="mt-6 mb-3 first:mt-0"><h4 class="text-lg font-bold text-blue-400 flex items-center gap-2"><span class="w-1 h-5 bg-blue-400 rounded"></span>${match[1]}</h4></div>`);
            }
            continue;
        }

        // 選項行（帶 ✅ 或 ❌）
        const optionMatch = line.match(/^([A-F])\.\s+(.+?)(✅|❌)$/);
        if (optionMatch) {
            const [, letter, content, emoji] = optionMatch;
            const isCorrect = emoji === '✅';
            const bgClass = isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700/50';
            const textClass = isCorrect ? 'text-green-300' : 'text-gray-400';
            const letterClass = isCorrect ? 'text-green-400' : 'text-slate-500';
            result.push(`<div class="ml-4 my-2.5 p-3 rounded-lg border ${bgClass} flex items-start gap-3"><span class="font-bold ${letterClass} text-lg shrink-0">${letter}.</span><span class="flex-1 ${textClass} leading-relaxed">${content}</span><span class="text-xl shrink-0">${emoji}</span></div>`);
            continue;
        }

        // 列表項
        const listMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (listMatch) {
            result.push(`<div class="ml-6 my-2 flex items-start gap-2"><span class="text-blue-400 font-semibold shrink-0">${listMatch[1]}.</span><span class="text-gray-300 leading-relaxed">${listMatch[2]}</span></div>`);
            continue;
        }

        // 一般文字（處理粗體）
        let formattedLine = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');

        // 如果前一行不是特殊格式，添加適當的間距和樣式
        if (result.length > 0 && !result[result.length - 1].includes('class="mt-6') && !result[result.length - 1].includes('class="bg-')) {
            formattedLine = `<div class="mb-2.5 text-gray-300 leading-relaxed text-base">${formattedLine}</div>`;
        } else {
            formattedLine = `<div class="text-gray-300 leading-relaxed text-base">${formattedLine}</div>`;
        }

        result.push(formattedLine);
    }

    return result.join('');
}
