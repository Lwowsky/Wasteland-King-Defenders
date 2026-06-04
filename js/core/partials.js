window.WKD = window.WKD || {};

WKD.loadPartials = async () => {
  const hosts = [...document.querySelectorAll('[data-include]')];
  await Promise.all(hosts.map(async host => {
    const path = host.dataset.include;
    if (!path) return;
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Cannot load partial: ${path}`);
    host.outerHTML = await response.text();
  }));
};
