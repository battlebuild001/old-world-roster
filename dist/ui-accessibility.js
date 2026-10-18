(() => {
  'use strict';

  const backdropSelector = '.modal-backdrop, .sheetBackdrop, .ruleBackdrop';
  const dialogSelector = '[role="dialog"]';
  const focusableSelector = 'a[href], area[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';
  const records = new Map();
  const pendingOpeners = new WeakMap();
  let previousTop = null;
  let lastFocus = document.activeElement;
  let lastInteraction = null;
  let scrollState = null;
  let movingFocus = false;
  let queued = false;

  function visible(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected) return false;
    if (element.closest('.hidden, [hidden], [inert]')) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }

  function editable(element) {
    return element instanceof HTMLElement && (element.matches('input, select, textarea') || element.isContentEditable);
  }

  function dialogs() {
    return [...document.querySelectorAll(`${backdropSelector.split(', ').map(selector => `${selector} ${dialogSelector}`).join(', ')}`)]
      .filter(visible)
      .map((dialog, index) => ({
        dialog,
        index,
        layer: Number.parseInt(getComputedStyle(dialog.closest(backdropSelector)).zIndex, 10) || 0
      }))
      .sort((a, b) => a.layer - b.layer || a.index - b.index)
      .map(entry => entry.dialog);
  }

  function topDialog() {
    return dialogs().at(-1) || null;
  }

  function focus(element, allowEditable = false) {
    if (!visible(element) || element.matches(':disabled') || (!allowEditable && editable(element))) return false;
    if (!element.matches(focusableSelector) && !element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    movingFocus = true;
    try {
      element.focus({preventScroll: true});
    } finally {
      movingFocus = false;
    }
    return document.activeElement === element;
  }

  function focusDialog(dialog) {
    if (!dialog) return false;
    const labelledBy = dialog.getAttribute('aria-labelledby')?.split(/\s+/).map(id => document.getElementById(id));
    const heading = labelledBy?.find(element => element && dialog.contains(element)) || dialog.querySelector('h1, h2, h3');
    return focus(heading) || focus(dialog.querySelector('.sheetClose, [data-dialog-close], button')) || focus(dialog);
  }

  function focusableElements(dialog) {
    return [...dialog.querySelectorAll(focusableSelector)].filter(element => visible(element) && !element.matches(':disabled') && element.tabIndex >= 0);
  }

  function openerCandidates(dialog) {
    const candidate = pendingOpeners.get(dialog) ||
      (!dialog.contains(document.activeElement) ? document.activeElement : null) || lastInteraction || lastFocus;
    pendingOpeners.delete(dialog);
    const parent = candidate instanceof Element ? candidate.closest(dialogSelector) : null;
    const inherited = parent ? records.get(parent)?.returnTo || [] : [];
    return [...new Set([candidate, ...inherited].filter(element => element instanceof HTMLElement && element !== document.body && !dialog.contains(element)))];
  }

  function restoreFocus(candidates, remainingDialog) {
    for (const candidate of candidates || []) {
      if ((!remainingDialog || remainingDialog.contains(candidate)) && focus(candidate)) return;
    }
    if (remainingDialog) {
      focusDialog(remainingDialog);
      return;
    }
    const fallback = ['main h2', 'main h3', '.sectionNav button.active', '.bottomNav button.active', 'main']
      .flatMap(selector => [...document.querySelectorAll(selector)])
      .find(visible);
    focus(fallback);
  }

  function lockScroll() {
    if (scrollState) return;
    const body = document.body;
    const properties = ['position', 'top', 'left', 'right', 'width', 'overflow', 'padding-right'];
    scrollState = {
      x: window.scrollX,
      y: window.scrollY,
      screen: body.dataset.screen || null,
      properties: properties.map(name => [name, body.style.getPropertyValue(name), body.style.getPropertyPriority(name)])
    };
    const scrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const padding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.setProperty('position', 'fixed');
    body.style.setProperty('top', `${-scrollState.y}px`);
    body.style.setProperty('left', `${-scrollState.x}px`);
    body.style.setProperty('right', '0');
    body.style.setProperty('width', '100%');
    body.style.setProperty('overflow', 'hidden');
    if (scrollbar) body.style.setProperty('padding-right', `${padding + scrollbar}px`);
  }

  function unlockScroll() {
    if (!scrollState) return false;
    const saved = scrollState;
    scrollState = null;
    const changedScreen = saved.screen !== (document.body.dataset.screen || null);
    for (const [name, value, priority] of saved.properties) {
      if (value) document.body.style.setProperty(name, value, priority);
      else document.body.style.removeProperty(name);
    }
    const root = document.documentElement;
    const behavior = root.style.getPropertyValue('scroll-behavior');
    const priority = root.style.getPropertyPriority('scroll-behavior');
    root.style.setProperty('scroll-behavior', 'auto', 'important');
    window.scrollTo(changedScreen ? 0 : saved.x, changedScreen ? 0 : saved.y);
    if (behavior) root.style.setProperty('scroll-behavior', behavior, priority);
    else root.style.removeProperty('scroll-behavior');
    return changedScreen;
  }

  function refresh() {
    queued = false;
    const open = dialogs();
    const openSet = new Set(open);
    const top = open.at(-1) || null;
    const closingTop = previousTop && !openSet.has(previousTop) ? records.get(previousTop) : null;
    // Register new dialogs before forgetting closed parents so a sheet opened
    // from another sheet can inherit its route back to the page.
    for (const dialog of open) {
      if (!records.has(dialog)) records.set(dialog, {returnTo: openerCandidates(dialog)});
    }
    for (const dialog of records.keys()) {
      if (!openSet.has(dialog)) records.delete(dialog);
    }
    let changedScreen = false;
    if (top) lockScroll();
    else changedScreen = unlockScroll();
    if (closingTop) restoreFocus(changedScreen ? [] : closingTop.returnTo, top);
    else if (top && top !== previousTop && !top.contains(document.activeElement)) focusDialog(top);
    previousTop = top;
  }

  function queueRefresh() {
    if (queued) return;
    queued = true;
    queueMicrotask(refresh);
  }

  function rememberInteraction(event) {
    const target = event.target instanceof Element ? event.target.closest(focusableSelector) : null;
    if (target instanceof HTMLElement) lastInteraction = target;
  }

  document.addEventListener('pointerdown', rememberInteraction, true);
  document.addEventListener('click', rememberInteraction, true);
  document.addEventListener('focusin', event => {
    const target = event.target;
    const containingDialog = target instanceof Element ? target.closest(dialogSelector) : null;
    if (containingDialog && !records.has(containingDialog) && !pendingOpeners.has(containingDialog)) {
      const candidate = [lastInteraction, lastFocus].find(element => element instanceof HTMLElement && !containingDialog.contains(element) && visible(element));
      if (candidate) pendingOpeners.set(containingDialog, candidate);
    }
    lastFocus = target;
    const top = topDialog();
    if (!movingFocus && top && !top.contains(target)) focusDialog(top);
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
    const top = topDialog();
    if (!top) return;
    const items = focusableElements(top);
    if (!items.length) {
      event.preventDefault();
      focusDialog(top);
      return;
    }
    const first = items[0];
    const last = items.at(-1);
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !items.includes(active))) {
      event.preventDefault();
      focus(last, true);
    } else if (!event.shiftKey && (active === last || !items.includes(active))) {
      event.preventDefault();
      focus(first, true);
    }
  }, true);

  new MutationObserver(queueRefresh).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden']});
  window.TOWUIAccessibility = {refresh, getActiveDialog: topDialog};
  refresh();
})();
