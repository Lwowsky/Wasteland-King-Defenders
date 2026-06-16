window.WKD = window.WKD || {};

function WKD_isStaffEmbedShellPartial(host) {
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('staffEmbed') !== '1') return false;
    const path = String(host?.dataset?.include || '');
    return path.includes('partials/header.html')
      || path.includes('partials/footer.html')
      || path.includes('partials/contact-modal.html');
  } catch {
    return false;
  }
}

WKD.loadPartials = async () => {
  const hosts = [...document.querySelectorAll('[data-include]')];
  await Promise.all(hosts.map(async host => {
    if (WKD_isStaffEmbedShellPartial(host)) {
      host.remove();
      return;
    }
    const path = host.dataset.include;
    if (!path) return;
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Cannot load partial: ${path}`);
    host.outerHTML = await response.text();
  }));
};
