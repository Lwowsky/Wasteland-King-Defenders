#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('index.html not found in', root);
  process.exit(1);
}
const html = fs.readFileSync(indexPath, 'utf8');
const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
  .map(m => m[1])
  .filter(src => !/^https?:/i.test(src));
const missing = scriptSrcs.filter(src => !fs.existsSync(path.join(root, src)));
if (missing.length) {
  console.error('Missing local scripts from index.html:');
  missing.forEach(x => console.error(' -', x));
  process.exit(2);
}
const duplicates = scriptSrcs.filter((s, i) => scriptSrcs.indexOf(s) !== i);
if (duplicates.length) {
  console.error('Duplicate script tags found:');
  [...new Set(duplicates)].forEach(x => console.error(' -', x));
  process.exit(3);
}

const NODE_TYPES = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
  DOCUMENT_NODE: 9,
};

function makeClassList(owner) {
  const set = new Set();
  return {
    add(...names) { names.filter(Boolean).forEach(n => set.add(String(n))); owner.className = [...set].join(' '); },
    remove(...names) { names.filter(Boolean).forEach(n => set.delete(String(n))); owner.className = [...set].join(' '); },
    toggle(name, force) {
      const key = String(name);
      const has = set.has(key);
      const next = force === undefined ? !has : !!force;
      if (next) set.add(key); else set.delete(key);
      owner.className = [...set].join(' ');
      return next;
    },
    contains(name) { return set.has(String(name)); },
  };
}

function makeStubTextNode(text = '') {
  return {
    nodeType: NODE_TYPES.TEXT_NODE,
    textContent: String(text),
    parentNode: null,
    remove() {
      if (this.parentNode && typeof this.parentNode.removeChild === 'function') {
        this.parentNode.removeChild(this);
      }
    },
    cloneNode() {
      return makeStubTextNode(this.textContent);
    },
  };
}

function makeStubEl(tagName = 'div') {
  const el = {
    nodeType: NODE_TYPES.ELEMENT_NODE,
    tagName: String(tagName).toUpperCase(),
    nodeName: String(tagName).toUpperCase(),
    style: {},
    dataset: {},
    attributes: {},
    className: '',
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    hidden: false,
    files: [],
    children: [],
    childNodes: [],
    parentNode: null,
    ownerDocument: null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    insertAdjacentHTML() {},
    querySelector() { return makeStubEl(); },
    querySelectorAll() { return []; },
    closest() { return null; },
    matches() { return false; },
    focus() {},
    blur() {},
    click() {},
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    cloneNode(deep = false) {
      const clone = makeStubEl(this.tagName.toLowerCase());
      clone.className = this.className;
      clone.textContent = this.textContent;
      clone.innerHTML = this.innerHTML;
      clone.value = this.value;
      clone.checked = this.checked;
      clone.disabled = this.disabled;
      clone.hidden = this.hidden;
      clone.dataset = { ...this.dataset };
      clone.attributes = { ...this.attributes };
      if (deep) {
        this.childNodes.forEach(node => clone.appendChild(node.cloneNode ? node.cloneNode(true) : makeStubTextNode(node.textContent || '')));
      }
      return clone;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'class') this.className = String(value);
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[key] = String(value);
      }
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name);
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    appendChild(node) {
      const child = node || makeStubEl();
      child.parentNode = this;
      this.childNodes.push(child);
      if (child.nodeType === NODE_TYPES.ELEMENT_NODE) this.children.push(child);
      return child;
    },
    insertBefore(node, referenceNode) {
      const child = node || makeStubEl();
      child.parentNode = this;
      if (!referenceNode) {
        return this.appendChild(child);
      }
      const idx = this.childNodes.indexOf(referenceNode);
      if (idx === -1) {
        return this.appendChild(child);
      }
      this.childNodes.splice(idx, 0, child);
      if (child.nodeType === NODE_TYPES.ELEMENT_NODE) {
        const elementIndex = this.children.indexOf(referenceNode);
        if (elementIndex === -1) this.children.push(child); else this.children.splice(elementIndex, 0, child);
      }
      return child;
    },
    replaceChild(newChild, oldChild) {
      const idx = this.childNodes.indexOf(oldChild);
      if (idx === -1) return this.appendChild(newChild);
      newChild.parentNode = this;
      oldChild.parentNode = null;
      this.childNodes[idx] = newChild;
      const oldElementIdx = this.children.indexOf(oldChild);
      if (newChild.nodeType === NODE_TYPES.ELEMENT_NODE) {
        if (oldElementIdx === -1) this.children.push(newChild); else this.children[oldElementIdx] = newChild;
      } else if (oldElementIdx !== -1) {
        this.children.splice(oldElementIdx, 1);
      }
      return oldChild;
    },
    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx !== -1) this.childNodes.splice(idx, 1);
      const eidx = this.children.indexOf(child);
      if (eidx !== -1) this.children.splice(eidx, 1);
      if (child) child.parentNode = null;
      return child;
    },
    prepend(...nodes) {
      [...nodes].reverse().forEach(node => this.insertBefore(node, this.firstChild || null));
    },
    append(...nodes) {
      nodes.forEach(node => this.appendChild(node));
    },
    remove() {
      if (this.parentNode && typeof this.parentNode.removeChild === 'function') {
        this.parentNode.removeChild(this);
      }
    },
  };
  Object.defineProperties(el, {
    classList: { value: makeClassList(el), enumerable: true },
    firstChild: { get() { return this.childNodes[0] || null; } },
    lastChild: { get() { return this.childNodes.length ? this.childNodes[this.childNodes.length - 1] : null; } },
    firstElementChild: { get() { return this.children[0] || null; } },
    childElementCount: { get() { return this.children.length; } },
  });
  return el;
}

const storage = {};
const listeners = { window: {}, document: {} };
function addL(target, type, fn) {
  (listeners[target][type] ??= []).push(fn);
}

const documentStub = {
  nodeType: NODE_TYPES.DOCUMENT_NODE,
  readyState: 'loading',
  visibilityState: 'visible',
  addEventListener(type, fn) { addL('document', type, fn); },
  removeEventListener() {},
  dispatchEvent(ev) {
    for (const fn of listeners.document[ev.type] || []) {
      try { fn(ev); } catch {}
    }
    return true;
  },
  getElementById() { return makeStubEl(); },
  querySelector() { return makeStubEl(); },
  querySelectorAll() { return []; },
  createElement(tagName = 'div') {
    const el = makeStubEl(tagName);
    el.ownerDocument = documentStub;
    return el;
  },
  createTextNode(text = '') {
    const node = makeStubTextNode(text);
    node.ownerDocument = documentStub;
    return node;
  },
};
documentStub.body = documentStub.createElement('body');
documentStub.documentElement = documentStub.createElement('html');
documentStub.head = documentStub.createElement('head');
documentStub.documentElement.appendChild(documentStub.head);
documentStub.documentElement.appendChild(documentStub.body);

const context = {
  console,
  setTimeout: fn => 0,
  clearTimeout() {},
  setInterval: fn => 0,
  clearInterval() {},
  requestAnimationFrame: fn => 0,
  cancelAnimationFrame() {},
  URL, URLSearchParams,
  Blob: function () {},
  FileReader: function () { this.readAsText = () => {}; this.readAsArrayBuffer = () => {}; this.addEventListener = () => {}; },
  FormData: function () {},
  navigator: { userAgent: 'static-smoke' },
  location: { hash: '', search: '', href: 'http://localhost/index.html' },
  history: { replaceState() {}, pushState() {} },
  alert() {}, confirm() { return true; }, prompt() { return ''; },
  Event: function (type, init = {}) { this.type = type; Object.assign(this, init); },
  CustomEvent: function (type, init = {}) { this.type = type; this.detail = init.detail; },
  Node: Object.assign(function () {}, NODE_TYPES),
  HTMLElement: function () {},
  addEventListener(type, fn) { addL('window', type, fn); },
  removeEventListener() {},
  dispatchEvent(ev) { for (const fn of listeners.window[ev.type] || []) try { fn(ev); } catch {} },
  localStorage: {
    getItem: k => storage[k] ?? null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: k => { delete storage[k]; },
    clear: () => { for (const k of Object.keys(storage)) delete storage[k]; },
  },
  sessionStorage: { getItem: k => null, setItem() {}, removeItem() {}, clear() {} },
  MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  ResizeObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  IntersectionObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  crypto: { randomUUID: () => 'uuid' },
  performance: { now: () => 0 },
  fetch: async () => ({ ok: false, json: async () => ({}), text: async () => '' }),
  XLSX: { utils: {} },
  html2canvas: async () => ({ toDataURL: () => '' }),
  document: documentStub,
};
context.window = context;
context.global = context;
context.globalThis = context;
context.self = context;
vm.createContext(context);
let loaded = 0;
for (const src of scriptSrcs) {
  const file = path.join(root, src);
  const code = fs.readFileSync(file, 'utf8');
  try {
    vm.runInContext(code, context, { filename: src, timeout: 2000 });
    loaded += 1;
  } catch (err) {
    console.error('FAILED while evaluating', src);
    console.error(err && err.stack ? err.stack : err);
    process.exit(4);
  }
}
context.document.readyState = 'complete';
try {
  context.document.dispatchEvent(new context.Event('DOMContentLoaded'));
} catch (err) {
  console.error('DOMContentLoaded dispatch failed');
  console.error(err && err.stack ? err.stack : err);
  process.exit(5);
}
console.log(`OK: loaded ${loaded} local scripts, no duplicate src, no missing files.`);
console.log('Note: this is a static smoke pass with a stub DOM, not a full browser regression test.');
