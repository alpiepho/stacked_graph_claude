// Node v25+ provides a stub localStorage global that lacks the full Web Storage API.
// vitest's populateGlobal skips localStorage because it already exists in global,
// so we manually replace it with jsdom's real implementation.
// vitest sets global.jsdom = dom after calling populateGlobal.
if (typeof globalThis.jsdom !== 'undefined') {
  const jsdomLocalStorage = globalThis.jsdom.window.localStorage
  Object.defineProperty(globalThis, 'localStorage', {
    value: jsdomLocalStorage,
    writable: true,
    configurable: true
  })
}
