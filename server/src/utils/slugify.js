/** "Belihuloya Site #2" -> "belihuloya-site-2" */
function slugify(str) {
  return (
    String(str)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  );
}

/**
 * A slug with the site's historic prefix ("loc-" / "proj-"), made unique
 * against `taken` by appending -2, -3, ... The prefixes match the ids the
 * old PHP panel generated, so imported and new records look alike.
 */
function uniqueSlug(prefix, name, taken) {
  const base = `${prefix}${slugify(name)}`;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
}

module.exports = { slugify, uniqueSlug };
