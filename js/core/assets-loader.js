window.WKD = window.WKD || {};

(() => {
  const loadedScripts = new Map();

  function loadScriptOnce(src) {
    if (!src) return Promise.reject(new Error('missing-script-src'));
    if (loadedScripts.has(src)) return loadedScripts.get(src);
    const existing = Array.from(document.scripts).find(script => script.src === src || script.src.endsWith(src));
    if (existing && existing.dataset.wkdLoaded === '1') return Promise.resolve(existing);

    const promise = new Promise((resolve, reject) => {
      if (existing) {
        existing.addEventListener('load', () => resolve(existing), { once: true });
        existing.addEventListener('error', () => reject(new Error(`script-load-failed:${src}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.wkdLoaded = '1';
      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error(`script-load-failed:${src}`));
      document.head.appendChild(script);
    });
    loadedScripts.set(src, promise);
    return promise;
  }

  WKD.loadScriptOnce = WKD.loadScriptOnce || loadScriptOnce;

  WKD.ensureXlsx = WKD.ensureXlsx || (async () => {
    if (window.XLSX) return window.XLSX;
    await WKD.loadScriptOnce('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    if (!window.XLSX) throw new Error('xlsx-not-ready');
    return window.XLSX;
  });

  WKD.ensureHtml2Canvas = WKD.ensureHtml2Canvas || (async () => {
    if (typeof window.html2canvas === 'function') return window.html2canvas;
    await WKD.loadScriptOnce('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    if (typeof window.html2canvas !== 'function') throw new Error('html2canvas-not-ready');
    return window.html2canvas;
  });
})();
