/* Paul Riley portfolio: small runtime that renders each page template and keeps its {{holes}} in sync with component state. */
(function () {
  'use strict';
  function get(o, path) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function fill(str, vals) { return str.replace(/\{\{\s*([\w$.]+)\s*\}\}/g, function (_, p) { var v = get(vals, p); return v == null ? '' : String(v); }); }
  var HOLE = /\{\{\s*[\w$.]+\s*\}\}/;

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.renderVals = function () { return {}; };
  DCLogic.prototype.setState = function (u) {
    var patch = typeof u === 'function' ? u(this.state, this.props) : u;
    if (!patch) return;
    var next = {}, k;
    for (k in this.state) next[k] = this.state[k];
    for (k in patch) next[k] = patch[k];
    this.state = next;
    var self = this;
    if (!self.__queued) { self.__queued = true; Promise.resolve().then(function () { self.__queued = false; self.__update(); }); }
  };
  window.DCLogic = DCLogic;

  function collect(root) {
    var binds = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var n = walker.currentNode;
    while (n) {
      if (n.nodeType === 1) {
        for (var i = 0; i < n.attributes.length; i++) {
          var a = n.attributes[i];
          if (HOLE.test(a.value)) binds.push({ el: n, attr: a.name, tpl: a.value });
        }
      } else if (n.nodeType === 3 && HOLE.test(n.nodeValue)) {
        binds.push({ node: n, tpl: n.nodeValue });
      }
      n = walker.nextNode();
    }
    return binds;
  }
  function apply(binds, vals) {
    for (var i = 0; i < binds.length; i++) {
      var b = binds[i], v = fill(b.tpl, vals);
      if (b.node) { if (b.node.nodeValue !== v) b.node.nodeValue = v; continue; }
      if (v === '' && /^aria-/.test(b.attr)) { if (b.el.hasAttribute(b.attr)) b.el.removeAttribute(b.attr); continue; }
      if (b.el.getAttribute(b.attr) !== v) b.el.setAttribute(b.attr, v);
    }
  }

  function boot() {
    var root = document.getElementById('dc-root');
    var tpl = document.getElementById('dc-tpl');
    var scr = document.querySelector('script[type="text/x-dc"]');
    if (!root || !tpl || !scr) return;
    var props = {};
    try {
      var spec = JSON.parse(scr.getAttribute('data-props') || '{}');
      Object.keys(spec).forEach(function (k) { if (spec[k] && 'default' in spec[k]) props[k] = spec[k].default; });
    } catch (e) {}
    var Component = new Function('DCLogic', scr.textContent + '\n;return typeof Component !== "undefined" ? Component : null;')(DCLogic);
    root.innerHTML = tpl.innerHTML;
    var binds = collect(root);
    var comp = Component ? new Component(props) : new DCLogic(props);
    if (!comp.props || !Object.keys(comp.props).length) comp.props = props;
    comp.__update = function () { apply(binds, comp.renderVals() || {}); if (comp.componentDidUpdate) comp.componentDidUpdate(); };
    apply(binds, comp.renderVals() || {});
    if (comp.componentDidMount) comp.componentDidMount();
    window.__dc = comp;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
