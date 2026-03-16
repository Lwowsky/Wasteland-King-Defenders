/*
 * Template rendering bootstrap and HTML helpers
 * Source parts: site_render_template_boot.js
 */

;(function(){var e=window.PNS=window.PNS||{};if(e.renderHtmlTemplate){window.renderHtmlTemplate=window.renderHtmlTemplate||e.renderHtmlTemplate;return;}e.renderHtmlTemplate=function(t,a){var r=document.getElementById(t);if(!r)return"";var n=typeof r.innerHTML==="string"?r.innerHTML:"";return n.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,function(e,t){return null!=a&&null!=a[t]?String(a[t]):""})};window.renderHtmlTemplate=window.renderHtmlTemplate||e.renderHtmlTemplate;})();
