const PREFIX = 'sg_'

/**
 * Save a value to localStorage under the sg_ namespace.
 * @param {string} key - without prefix
 * @param {*} value - will be JSON-serialized
 */
export function save(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

/**
 * Load a value from localStorage.
 * @param {string} key - without prefix
 * @param {*} defaultValue - returned if key is absent or parse fails
 * @returns {*}
 */
export function load(key, defaultValue = null) {
  const raw = localStorage.getItem(PREFIX + key)
  if (raw === null) return defaultValue
  try {
    return JSON.parse(raw)
  } catch {
    return defaultValue
  }
}

/**
 * Load all persisted app settings with their defaults.
 * @returns {{
 *   csv: string,
 *   dateCol: string|null,
 *   stackCol: string|null,
 *   filters: { showAllCC: boolean, replaceCUPay: boolean, pickedCC: string[] },
 *   hiddenSeries: string[],
 *   csvCollapsed: boolean
 * }}
 */
export function loadAll() {
  return {
    csv:          load('csv', ''),
    dateCol:      load('date_col', null),
    stackCol:     load('stack_col', null),
    filters:      load('filters', { showAllCC: true, replaceCUPay: false, pickedCC: [] }),
    hiddenSeries: load('hidden_series', []),
    csvCollapsed: load('csv_collapsed', true)
  }
}
