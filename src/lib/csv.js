/* ==========================================================================
   csv.js — reading a CSV of user IDs (FR-14).
   ========================================================================== */
const ID_HEADERS = ['user_id', 'userid', 'user id', 'id', 'uid', 'customer_id'];
const csvCells = (line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

export function parseUserIds(text) {
  const rows = text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length === 0) return { ids: [], column: 'column 1', skipped: 0 };

  // A first row only counts as a header if one of its cells names an id
  // column — otherwise a headerless export would silently lose its first user.
  const head = csvCells(rows[0]).map((c) => c.toLowerCase());
  const at = head.findIndex((c) => ID_HEADERS.includes(c));
  const index = at >= 0 ? at : 0;
  const column = at >= 0 ? csvCells(rows[0])[index] : 'column 1';
  const body = at >= 0 ? rows.slice(1) : rows;

  const seen = new Set();
  let skipped = 0;
  body.forEach((line) => {
    const value = csvCells(line)[index] || '';
    if (!value || seen.has(value)) { skipped += 1; return; }
    seen.add(value);
  });
  return { ids: [...seen], column, skipped };
}

/**
 * Reads one picked or dropped file into the summary the draft stores.
 * The ids themselves are not kept — a draft is persisted, and forty thousand
 * of them would be a localStorage quota error rather than a feature.
 */
export async function readUserList(file, fail) {
  if (!file) return null;
  if (!/\.csv$/i.test(file.name)) {
    fail('Not a CSV', `${file.name} is not a .csv file. Export the list as CSV and try again.`);
    return null;
  }
  const { ids, column, skipped } = parseUserIds(await file.text());
  if (ids.length === 0) {
    fail('No user IDs found', `${file.name} has no readable rows. Expected one user ID per row.`);
    return null;
  }
  return {
    name: file.name,
    size: ids.length,
    column,
    skipped,
    sample: ids.slice(0, 4),
    uploadedAt: new Date().toISOString(),
  };
}
