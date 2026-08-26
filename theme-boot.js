// theme-boot.js — run before first paint so the page never flashes the wrong
// theme. Deliberately a separate file rather than an inline <script>, which
// lets the Content-Security-Policy forbid inline script entirely.
(function () {
  try {
    var saved = localStorage.getItem('vibecheck-theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {
    /* private mode: the system preference is a fine default */
  }
})();
