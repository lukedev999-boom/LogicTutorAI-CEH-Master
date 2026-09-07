/**
 * 英文詞形還原規則（建置期與執行期共用）
 *
 * ⚠️ 這份檔案同時被 tools/build-dict.js（Node）與 assets/js/wordlookup.js
 *    （瀏覽器）使用。兩邊的規則必須完全一致：建置期正是靠這組規則判斷
 *    「哪些變形可由規則推導」，能推導的就不寫進 lemma.js 以節省體積。
 *    規則若不同步，執行期就會查不到那些被省略的詞。
 *
 * 載入方式：
 *   - Node：require('../assets/js/lemma-rules.js') 取得 { lemmaCandidates }
 *   - 瀏覽器：以 <script> 引入後掛在 window.lemmaCandidates
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.lemmaCandidates = api.lemmaCandidates;
})(typeof self !== 'undefined' ? self : this, function () {

    // 後綴 → 可能的原形詞尾。順序即嘗試順序，先長後短避免 -es 被 -s 搶走。
    const SUFFIX_RULES = [
        ['ies',  ['y']],
        ['ied',  ['y']],
        ['ier',  ['y']],
        ['iest', ['y']],
        ['ily',  ['y']],
        ['sses', ['ss']],
        ['ches', ['ch']],
        ['shes', ['sh']],
        ['xes',  ['x']],
        ['zes',  ['z']],
        ['ves',  ['f', 'fe']],
        ['ing',  ['', 'e']],
        ['est',  ['', 'e']],
        ['ed',   ['', 'e']],
        ['er',   ['', 'e']],
        ['ly',   ['']],
        ['es',   ['', 'e']],
        ['s',    ['']],
    ];

    /**
     * 產生某個詞形的所有候選原形（不保證存在於詞典中，由呼叫端逐一查表）
     * @param {string} word - 已轉小寫的英文詞形
     * @returns {string[]} 候選原形，依可信度排序
     */
    function lemmaCandidates(word) {
        const out = [];
        const push = (w) => {
            if (w && w.length >= 2 && w !== word && !out.includes(w)) out.push(w);
        };

        // 所有格：organization's → organization
        if (/'s$/.test(word)) push(word.slice(0, -2));
        if (/s'$/.test(word)) push(word.slice(0, -1));

        for (const [suffix, replacements] of SUFFIX_RULES) {
            if (!word.endsWith(suffix)) continue;
            const stem = word.slice(0, -suffix.length);
            if (stem.length < 2) continue;

            for (const rep of replacements) push(stem + rep);

            // 重複子音還原：running → run、scanned → scan、bigger → big
            const last = stem[stem.length - 1];
            if (stem.length > 2 && last === stem[stem.length - 2] && !'aeiou'.includes(last)) {
                push(stem.slice(0, -1));
            }
        }
        return out;
    }

    return { lemmaCandidates };
});
