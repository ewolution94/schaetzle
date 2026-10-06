// Applies the saved theme and language before first paint, so there's no flash of the wrong
// one, and pins theme-color to the theme (it colours an installed app's status bar). The keys
// are the shared ones (`ewo:theme`, `ewo:lang`); keep in step with src/lib/i18n.svelte.ts and
// Folio's <ewo-theme-toggle>.
try {
  var theme = localStorage.getItem('ewo:theme');
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].content = theme === 'light' ? '#f5f4f1' : '#09090b';
  }
  var lang = localStorage.getItem('ewo:lang');
  if (lang !== 'en' && lang !== 'de') lang = (navigator.language || '').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
  document.documentElement.lang = lang;
} catch (e) {}
