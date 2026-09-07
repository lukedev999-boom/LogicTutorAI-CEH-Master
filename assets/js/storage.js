/** 儲存被封鎖或容量不足時，維持本次頁面作答；重新整理後可能無法保留。 */
const storage = (() => {
    const memory = new Map();
    return {
        getItem(key) {
            if (memory.has(key)) return memory.get(key);
            try {
                return window.localStorage.getItem(key);
            } catch {
                return null;
            }
        },
        setItem(key, value) {
            memory.set(key, String(value));
            try {
                window.localStorage.setItem(key, String(value));
            } catch {
                console.warn('瀏覽器無法儲存資料；目前使用記憶體暫存。');
            }
        },
        removeItem(key) {
            memory.set(key, null);
            try {
                window.localStorage.removeItem(key);
            } catch {
                /* 記憶體已清除。 */
            }
        },
    };
})();
