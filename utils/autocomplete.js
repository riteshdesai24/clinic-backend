const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.parseAutocompleteQuery = (query) => {
  const term = typeof query.q === 'string'
    ? query.q.trim()
    : typeof query.search === 'string'
      ? query.search.trim()
      : '';
  const requestedLimit = Number.parseInt(query.limit, 10) || 10;

  return {
    term,
    regex: new RegExp(escapeRegex(term), 'i'),
    limit: Math.min(Math.max(requestedLimit, 1), 20)
  };
};