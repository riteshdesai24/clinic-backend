const logger = require('../utils/logger');
const { Country, State, City } = require('../super-admin/models/LocationMaster');

const API_ROOT = 'https://countriesnow.space/api/v0.1/countries';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();
const CURRENT_STATES_AND_UTS = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const normalize = (value) => typeof value === 'string' ? value.trim() : '';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function getLocationData(cacheKey, path, options) {
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error(`Location provider returned HTTP ${response.status}`);
  const result = await response.json();
  if (result.error || !Array.isArray(result.data)) throw new Error('Invalid response from location provider');

  cache.set(cacheKey, { data: result.data, expiresAt: Date.now() + CACHE_TTL_MS });
  return result.data;
}

function matchingValues(values, query, limit) {
  const regex = query ? new RegExp(escapeRegex(query), 'i') : null;
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))]
    .filter((value) => !regex || regex.test(value))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit)
    .map((value) => ({ value, label: value }));
}

function queryOptions(req) {
  const q = normalize(req.query.q || req.query.search);
  const requestedLimit = Number.parseInt(req.query.limit, 10) || 10;
  return { q, limit: Math.min(Math.max(requestedLimit, 1), 20) };
}

exports.countries = async (req, res) => {
  const { q, limit } = queryOptions(req);
  const suggestions = matchingValues(['India'], q, limit);
  const country = await Country.findOne({ name: /^India$/i, isActive: true }).select('_id name').lean();
  const data = suggestions.map((item) => ({ ...item, id: country?._id || null }));
  return res.json({ success: true, count: data.length, data });
};

exports.states = async (req, res) => {
  try {
    const country = normalize(req.query.country);
    const { q, limit } = queryOptions(req);
    if (!country) return res.status(400).json({ success: false, message: 'country query parameter is required' });
    if (country.toLowerCase() !== 'india') return res.status(400).json({ success: false, message: 'Only India is supported' });

    const suggestions = matchingValues(CURRENT_STATES_AND_UTS, q, limit);
    const countryRecord = await Country.findOne({ name: /^India$/i, isActive: true }).select('_id').lean();
    const states = countryRecord
      ? await State.find({ country: countryRecord._id, isActive: true, name: { $in: suggestions.map((item) => item.value) } }).select('_id name country').lean()
      : [];
    const statesByName = new Map(states.map((item) => [item.name.toLowerCase(), item]));
    const data = suggestions.map((item) => ({
      ...item,
      id: statesByName.get(item.value.toLowerCase())?._id || null,
      countryId: countryRecord?._id || null
    }));
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    logger.error('State autocomplete error', { error: err.message });
    return res.status(502).json({ success: false, message: 'Unable to load state suggestions' });
  }
};

exports.cities = async (req, res) => {
  try {
    const country = normalize(req.query.country);
    let state = normalize(req.query.state);
    const { q, limit } = queryOptions(req);
    if (!country || !state) return res.status(400).json({ success: false, message: 'country and state query parameters are required' });
    if (country.toLowerCase() !== 'india') return res.status(400).json({ success: false, message: 'Only India is supported' });

    const countryRecord = await Country.findOne({ name: /^India$/i, isActive: true }).select('_id').lean();
    let stateRecord = null;
    if (countryRecord && /^[a-f\d]{24}$/i.test(state)) {
      stateRecord = await State.findOne({ _id: state, country: countryRecord._id, isActive: true }).select('_id name country').lean();
      if (stateRecord) state = stateRecord.name;
    } else if (countryRecord) {
      stateRecord = await State.findOne({ country: countryRecord._id, name: new RegExp(`^${escapeRegex(state)}$`, 'i'), isActive: true }).select('_id name country').lean();
    }

    const providerStates = state.toLowerCase() === 'dadra and nagar haveli and daman and diu'
      ? ['Dadra and Nagar Haveli', 'Daman and Diu']
      : [state];
    const cities = (await Promise.all(providerStates.map((providerState) => {
      const cacheKey = `cities:${country.toLowerCase()}:${providerState.toLowerCase()}`;
      return getLocationData(cacheKey, '/state/cities', {
        method: 'POST', body: JSON.stringify({ country, state: providerState })
      });
    }))).flat();
    const suggestions = matchingValues(cities, q, limit);
    const cityRecords = stateRecord
      ? await City.find({ state: stateRecord._id, isActive: true, name: { $in: suggestions.map((item) => item.value) } }).select('_id name state').lean()
      : [];
    const citiesByName = new Map(cityRecords.map((item) => [item.name.toLowerCase(), item]));
    const data = suggestions.map((item) => ({
      ...item,
      id: citiesByName.get(item.value.toLowerCase())?._id || null,
      stateId: stateRecord?._id || null
    }));
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    logger.error('City autocomplete error', { error: err.message });
    return res.status(502).json({ success: false, message: 'Unable to load city suggestions' });
  }
};
