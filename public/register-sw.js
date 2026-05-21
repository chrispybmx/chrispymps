// Service Worker registration — external file per CSP compliance
// (inline scripts bloccati da CSP in produzione)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
