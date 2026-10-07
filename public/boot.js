// Applies the saved theme and language before first paint, so there's no flash of the wrong
// one, and pins theme-color to the theme (it colours an installed app's status bar). The keys
// are the shared ones (`ewo:theme`, `ewo:lang`; no key means System); keep in step with
// src/lib/i18n.svelte.ts (systemLang) and Folio's setTheme.
try {
  var theme = localStorage.getItem('ewo:theme');
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].content = theme === 'light' ? '#f5f4f1' : '#09090b';
  }
  var lang = localStorage.getItem('ewo:lang');
  if (lang !== 'en' && lang !== 'de') {
    // System: the first of the browser's languages the game speaks, English otherwise.
    var tags = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    lang = 'en';
    for (var j = 0; j < tags.length; j++) {
      var base = String(tags[j]).toLowerCase().slice(0, 2);
      if (base === 'de' || base === 'en') {
        lang = base;
        break;
      }
    }
  }
  document.documentElement.lang = lang;
} catch (e) {}
