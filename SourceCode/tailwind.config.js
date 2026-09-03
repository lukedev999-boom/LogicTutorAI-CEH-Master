/**
 * Tailwind 建置設定（僅建置期使用，執行期不需要）
 *
 * 產出 assets/vendor/tailwind.css 供頁面以純靜態方式載入，
 * 取代原本的 cdn.tailwindcss.com 執行期 JIT 編譯器。
 */
module.exports = {
    content: [
        './index-template.html',
        './partials/**/*.html',
        './assets/js/**/*.js',
    ],
    // JS 動態附加的類別無法被靜態掃描，需明確保留
    safelist: [
        'answered', 'open', 'timer-shake', 'timer-warning',
        'bg-green-500', 'bg-green-500/10', 'bg-red-500', 'bg-red-500/10',
        'bg-slate-600', 'bg-slate-700', 'bg-slate-800/50',
        'border', 'border-emerald-500', 'border-green-500', 'border-red-500',
        'border-slate-500', 'border-slate-600',
        'cursor-default', 'flex', 'hidden',
        'hover:border-blue-500',
        'text-emerald-400', 'text-slate-300', 'text-slate-400', 'text-white',
        'text-green-400', 'text-red-400', 'text-blue-400',
        'bg-blue-600/20', 'bg-purple-600/20', 'bg-green-600/20',
        'text-purple-400',
    ],
    theme: {
        extend: {
            colors: {
                primary: '#0f172a',
                accent: '#3b82f6',
                success: '#22c55e',
                danger: '#ef4444',
                warm: '#f59e0b'
            },
            fontFamily: {
                display: ['"PingFang TC"', '"Noto Sans TC"', '"Microsoft JhengHei"', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
            }
        }
    },
    plugins: []
};
