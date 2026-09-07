/**
 * 英文單字即點即譯
 * ================================================================
 * 為英文題目的每個單字加上虛線底線，點擊後在該字下方彈出繁體中文釋義。
 * 完全離線：釋義來自本地載入的 glossary.js / dict.js / lemma.js，
 * 執行期不發出任何網路請求。
 *
 * 資料來源與查詢優先序：
 *   1. window.__EN_GLOSSARY__  CEH 資安術語表（手寫，優先於一般詞典）
 *   2. window.__EN_DICT__      通用英漢詞典（由 ECDICT 建置，已轉繁體）
 *   3. window.__EN_LEMMA__     不規則詞形還原表（feet → foot）
 *   4. lemmaCandidates()       規則詞形還原（attackers → attacker）
 *   5. 複合詞拆解（cross-site → cross ＋ site）與前綴剝離（misconfigured）
 *
 * 對外介面：
 *   WordLookup.apply(element)  為元素內的英文單字加上底線與點擊行為
 *   WordLookup.clear()         關閉目前開啟的釋義卡
 */
(function () {
    'use strict';

    // 單字切分：允許詞中的連字號與撇號，但不吃掉結尾的標點。
    // man-in-the-middle 會被視為一個完整的詞，organization's 亦然。
    const WORD_RE = /[A-Za-z]+(?:[''-][A-Za-z]+)*/g;

    // 這些容器內的文字不做處理（程式碼片段照原樣呈現較易閱讀）
    const SKIP_TAGS = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA']);

    // 純功能詞不值得查，加上底線只會造成視覺噪音
    const STOP_WORDS = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at',
        'by', 'for', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
        'it', 'its', 'as', 'that', 'this', 'these', 'those', 'he', 'she', 'they',
        'we', 'you', 'i', 'his', 'her', 'their', 'our', 'your', 'my', 'them',
        'him', 'us', 'me', 'not', 'no', 'so', 'than', 'then', 'too', 'very',
        'do', 'does', 'did', 'has', 'have', 'had', 'will', 'would', 'can',
        'could', 'may', 'might', 'must', 'shall', 'should',
    ]);

    // 可剝離的前綴：misconfigured → configured、cybersecurity → security
    const PREFIXES = [
        ['un', '非／未'], ['non', '非'], ['mis', '錯誤地'], ['re', '重新'],
        ['pre', '預先'], ['post', '之後'], ['over', '過度'], ['under', '不足'],
        ['sub', '次級'], ['multi', '多重'], ['anti', '反'], ['cyber', '網路'],
        ['inter', '互相'], ['auto', '自動'], ['de', '解除'], ['dis', '不'],
    ];

    let tooltipEl = null;
    let activeWordEl = null;
    let listenersBound = false;

    // ==================== 查詢 ====================

    // 一律用 hasOwnProperty 判斷：直接寫 dict[key] 在 key 為 undefined 時，
    // JS 會把它轉成字串 "undefined" 去查表，而詞典裡剛好收錄了 undefined
    // 這個英文單字，會回傳「不明確的、未下定義的」這種完全無關的結果。
    function pick(table, key) {
        if (!table || typeof key !== 'string' || !key) return null;
        return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
    }

    const glossary = () => window.__EN_GLOSSARY__ || null;
    const dictionary = () => window.__EN_DICT__ || null;
    const lemmaTable = () => window.__EN_LEMMA__ || null;

    function candidatesOf(word) {
        return typeof window.lemmaCandidates === 'function' ? window.lemmaCandidates(word) : [];
    }

    /**
     * 在單一張表內完成「直接查 → 所有格剝離 → 不規則還原 → 規則還原」的完整嘗試。
     *
     * 之所以要以「表」為單位跑完整輪，而不是先把詞形還原好再一次查兩張表：
     * hardened 這個詞在通用詞典裡有獨立詞條（「變硬的」），若讓通用詞典的直接命中
     * 優先，就永遠看不到術語表裡 harden 的「強化（收緊系統設定）」。
     * 術語表必須連同還原一起，整輪贏過通用詞典。
     */
    function resolveIn(table, sourceName, word) {
        if (!table) return null;
        const make = (text, base) => (base && base !== word ? { text, source: sourceName, base } : { text, source: sourceName });

        let value = pick(table, word);
        if (value) return make(value);

        const possessive = word.replace(/'s$/, '').replace(/s'$/, 's');
        const forms = possessive !== word ? [possessive] : [];

        for (const form of forms) {
            value = pick(table, form);
            if (value) return make(value, form);
        }

        for (const form of [word].concat(forms)) {
            const irregular = pick(lemmaTable(), form);
            if (irregular) {
                value = pick(table, irregular);
                if (value) return make(value, irregular);
            }
            for (const candidate of candidatesOf(form)) {
                value = pick(table, candidate);
                if (value) return make(value, candidate);
            }
        }
        return null;
    }

    /** 術語表整輪優先於通用詞典 */
    function lookupWord(word) {
        return resolveIn(glossary(), 'glossary', word) || resolveIn(dictionary(), 'dict', word);
    }

    /**
     * ECDICT 對變形詞常只寫「go的過去式」，光看這行使用者仍不知道 go 是什麼意思，
     * 因此把原形的釋義一併帶出來。
     */
    function expandInflection(entry) {
        const m = entry.text.match(/^([a-zA-Z-]+)\s*的(過去式|過去分詞|現在分詞|複數形?|第三人稱單數|比較級|最高級)/);
        if (!m) return entry;
        const base = lookupWord(m[1].toLowerCase());
        if (!base) return entry;
        return { text: entry.text + '｜' + m[1] + '：' + base.text, source: entry.source };
    }

    /** 複合詞拆解：cross-site → cross ＋ site */
    function lookupCompound(word) {
        if (!word.includes('-')) return null;
        const segments = word.split('-').filter(Boolean);
        if (segments.length < 2 || segments.length > 4) return null;

        const parts = [];
        for (const seg of segments) {
            const hit = lookupWord(seg);
            if (!hit) return null;   // 有一段查不到就整體放棄，半套翻譯只會誤導
            parts.push(seg + '：' + hit.text.replace(/^[a-z]+\.\s*/, '').split('；')[0]);
        }
        return { text: parts.join('｜'), source: 'compound' };
    }

    /** 前綴剝離：misconfigured → 錯誤地 ＋ configured */
    function lookupPrefixed(word) {
        for (const [prefix, meaning] of PREFIXES) {
            if (!word.startsWith(prefix) || word.length < prefix.length + 4) continue;
            const rest = word.slice(prefix.length);
            const hit = lookupWord(rest);
            if (hit) return { text: meaning + '＋' + rest + '：' + hit.text, source: 'prefix' };
        }
        return null;
    }

    /**
     * 查詢一個英文詞的中文釋義
     * @param {string} raw - 原始詞形（大小寫不拘）
     * @returns {{text: string, source: string, base?: string}|null}
     */
    function lookup(raw) {
        const word = raw.toLowerCase().replace(/[\u2018\u2019]/g, "'");
        if (!word) return null;
        const hit = lookupWord(word) || lookupCompound(word) || lookupPrefixed(word);
        return hit ? expandInflection(hit) : null;
    }

    // ==================== 標記單字 ====================

    /**
     * 為元素內的英文單字包上可點擊的 span
     * @param {HTMLElement} root
     */
    function apply(root) {
        if (!root) return;
        closeTooltip();

        // 先收集再改寫：邊走邊改 DOM 會讓 TreeWalker 的走訪結果不可預期
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue || !/[A-Za-z]/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
                for (let el = node.parentElement; el && el !== root; el = el.parentElement) {
                    if (SKIP_TAGS.has(el.tagName) || el.classList.contains('wordlookup-term')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        });

        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        for (const node of textNodes) {
            const text = node.nodeValue;
            const fragment = document.createDocumentFragment();
            let cursor = 0;
            let matched = false;

            WORD_RE.lastIndex = 0;
            let match;
            while ((match = WORD_RE.exec(text)) !== null) {
                const word = match[0];
                if (word.length < 2 || STOP_WORDS.has(word.toLowerCase())) continue;
                if (!lookup(word)) continue;   // 查不到就不加底線，避免點了沒反應

                if (match.index > cursor) {
                    fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
                }
                const span = document.createElement('span');
                span.className = 'wordlookup-term';
                span.textContent = word;
                span.setAttribute('role', 'button');
                span.setAttribute('tabindex', '0');
                span.setAttribute('aria-label', word + '，點擊查看中文釋義');
                fragment.appendChild(span);

                cursor = match.index + word.length;
                matched = true;
            }

            if (!matched) continue;
            if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)));
            node.parentNode.replaceChild(fragment, node);
        }

        bindGlobalListeners();
    }

    // ==================== 釋義卡 ====================

    function ensureTooltip() {
        if (tooltipEl) return tooltipEl;
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'wordlookup-tip';
        tooltipEl.setAttribute('role', 'tooltip');
        tooltipEl.innerHTML =
            '<div class="wordlookup-tip-head">'
            + '<span class="wordlookup-tip-word"></span>'
            + '<span class="wordlookup-tip-tag"></span>'
            + '</div>'
            + '<div class="wordlookup-tip-body"></div>'
            + '<div class="wordlookup-tip-arrow"></div>';
        document.body.appendChild(tooltipEl);
        return tooltipEl;
    }

    function openTooltip(wordEl) {
        const word = wordEl.textContent;
        const entry = lookup(word);
        if (!entry) return;

        const tip = ensureTooltip();
        tip.querySelector('.wordlookup-tip-word').textContent = word;

        const tag = tip.querySelector('.wordlookup-tip-tag');
        if (entry.source === 'glossary') {
            tag.textContent = '資安術語';
            tag.className = 'wordlookup-tip-tag is-term';
        } else if (entry.base && entry.base !== word.toLowerCase()) {
            tag.textContent = '原形 ' + entry.base;
            tag.className = 'wordlookup-tip-tag';
        } else {
            tag.textContent = '';
            tag.className = 'wordlookup-tip-tag';
        }
        tip.querySelector('.wordlookup-tip-body').textContent = entry.text;

        if (activeWordEl) activeWordEl.classList.remove('is-active');
        activeWordEl = wordEl;
        wordEl.classList.add('is-active');

        tip.classList.add('is-visible');
        position(tip, wordEl);
    }

    /** 釋義卡預設貼在單字下方，空間不足時翻到上方，並夾在視窗水平範圍內 */
    function position(tip, wordEl) {
        tip.style.left = '0px';
        tip.style.top = '0px';
        tip.classList.remove('is-above');

        const rect = wordEl.getBoundingClientRect();
        const tipRect = tip.getBoundingClientRect();
        const margin = 8;
        const gap = 10;

        let left = rect.left + rect.width / 2 - tipRect.width / 2;
        left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));

        let top = rect.bottom + gap;
        if (top + tipRect.height > window.innerHeight - margin) {
            const above = rect.top - tipRect.height - gap;
            if (above > margin) {
                top = above;
                tip.classList.add('is-above');
            } else {
                top = Math.max(margin, window.innerHeight - tipRect.height - margin);
            }
        }

        tip.style.left = Math.round(left) + 'px';
        tip.style.top = Math.round(top) + 'px';

        // 箭頭對準單字中心，即使卡片被視窗邊界推開也不會指錯位置
        const arrow = tip.querySelector('.wordlookup-tip-arrow');
        const arrowX = rect.left + rect.width / 2 - left;
        arrow.style.left = Math.round(Math.max(14, Math.min(arrowX, tipRect.width - 14))) + 'px';
    }

    function closeTooltip() {
        if (tooltipEl) tooltipEl.classList.remove('is-visible');
        if (activeWordEl) activeWordEl.classList.remove('is-active');
        activeWordEl = null;
    }

    function bindGlobalListeners() {
        if (listenersBound) return;
        listenersBound = true;

        document.addEventListener('click', (e) => {
            const term = e.target.closest && e.target.closest('.wordlookup-term');
            if (term) {
                e.stopPropagation();
                // 點同一個字視為收合
                if (term === activeWordEl) closeTooltip();
                else openTooltip(term);
                return;
            }
            if (!e.target.closest || !e.target.closest('.wordlookup-tip')) closeTooltip();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeTooltip();
            if ((e.key === 'Enter' || e.key === ' ') && document.activeElement
                && document.activeElement.classList.contains('wordlookup-term')) {
                e.preventDefault();
                openTooltip(document.activeElement);
            }
        });

        // 捲動或改變視窗大小時，卡片會脫離原本的單字，直接收起最單純
        window.addEventListener('scroll', closeTooltip, true);
        window.addEventListener('resize', closeTooltip);
    }

    window.WordLookup = { apply, clear: closeTooltip, lookup };
})();
