// Plain script (not a module), so it runs even on browsers that can't load the app.
// If the app hasn't drawn anything after a few seconds, explain what to do.
setTimeout(function () {
  var app = document.getElementById('app');
  if (!app || !app.querySelector('[data-loading]')) return;
  app.innerHTML = '<div class="empty"><div class="big" aria-hidden="true">⚠️</div>' +
    '<p><strong>Gentle Kitchen couldn’t start.</strong></p>' +
    '<p>Your phone’s browser may need updating. On iPhone: Settings › General › Software Update. ' +
    'Then close this page fully and open it again.</p></div>';
}, 6000);
