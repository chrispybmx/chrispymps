// Service Worker registration — external file per CSP compliance
// (inline scripts bloccati da CSP in produzione)
if ('serviceWorker' in navigator) {
  var wasControlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (wasControlled) window.dispatchEvent(new Event('chrispy:update-ready'));
    wasControlled = true;
  });
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
