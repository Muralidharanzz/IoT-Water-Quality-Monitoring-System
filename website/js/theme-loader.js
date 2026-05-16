/* theme-loader.js — runs synchronously BEFORE first paint.
   Reads the user's saved theme preference from localStorage
   and sets data-theme="light" on <html> so CSS paints correctly. */
(function () {
    try {
        var s = JSON.parse(localStorage.getItem('aquasense_settings'));
        if (s && s.darkMode === false) {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    } catch (e) { /* ignore parse errors — dark is default */ }
})();
