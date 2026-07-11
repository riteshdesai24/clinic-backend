const Insurance = require('../models/Insurance');
const xlsx = require('xlsx');

const FIELD_ALIASES = {
  insurername: 'insuranceCompany',
  insurancecompany: 'insuranceCompany',
  insurancesubcompany: 'insuranceSubCompany',
  insurancepolicy: 'insurancePolicy',
  insuranceidnumber: 'insuranceIdNumber',
  company: 'companyName',
  companyname: 'companyName',
  policynumber: 'policyNumber',
  patientid: 'patientId',
  policytype: 'coverageType',
  coveragetype: 'coverageType',
  coverageamount: 'coverageAmount',
  plantype: 'planType',
  premiumamount: 'premiumAmount',
  startdate: 'startDate',
  enddate: 'endDate',
  holdername: 'holderName',
  email: 'contactEmail',
  contactemail: 'contactEmail',
  contactnumber: 'contactPhone',
  contactphone: 'contactPhone',
  address: 'address',
  status: 'status',
  notes: 'notes'
};

const SUPPORTED_FIELDS = new Set([
  'insuranceCompany',
  'insuranceSubCompany',
  'insurancePolicy',
  'insuranceIdNumber',
  'companyName',
  'policyNumber',
  'patientId',
  'coverageType',
  'coverageAmount',
  'planType',
  'premiumAmount',
  'startDate',
  'endDate',
  'holderName',
  'contactEmail',
  'contactPhone',
  'address',
  'status',
  'notes'
]);

const normalizeHeader = (value) =>
  value.toString().trim().toLowerCase().replace(/[-_\s]/g, '');

const parseValue = (field, value) => {
  if (value === null || value === undefined || value === '') return undefined;
  if (field === 'premiumAmount' || field === 'coverageAmount') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (field === 'startDate' || field === 'endDate') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return value;
};

const mapRowToInsurance = (row) => {
  const insurance = {};
  Object.keys(row).forEach((rawKey) => {
    const normalized = normalizeHeader(rawKey);
    const field = FIELD_ALIASES[normalized] || normalized;
    if (!SUPPORTED_FIELDS.has(field)) return;

    const parsed = parseValue(field, row[rawKey]);
    if (parsed !== undefined) insurance[field] = parsed;
  });
  return insurance;
};

/**
 * =====================================================
 * CREATE INSURANCE
 * =====================================================
 */
exports.create = async (req, res) => {
  try {
    const insurance = await Insurance.create(mapRowToInsurance(req.body));

    return res.status(201).json({
      success: true,
      message: 'Insurance created successfully',
      data: insurance
    });
  } catch (error) {
    console.error('Create Insurance Error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Insurance policy already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * LIST INSURANCES
 * =====================================================
 */
exports.list = async (req, res) => {
  try {
    const insurances = await Insurance.find().sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'Insurances fetched successfully',
      data: insurances
    });
  } catch (error) {
    console.error('List Insurance Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * GET INSURANCE DETAIL
 * =====================================================
 */
exports.getById = async (req, res) => {
  try {
    const insurance = await Insurance.findById(req.params.id);

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Insurance not found'
      });
    }

    return res.json({
      success: true,
      data: insurance
    });
  } catch (error) {
    console.error('Get Insurance Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * UPDATE INSURANCE
 * =====================================================
 */
exports.update = async (req, res) => {
  try {
    const insurance = await Insurance.findByIdAndUpdate(
      req.params.id,
      mapRowToInsurance(req.body),
      { new: true, runValidators: true }
    );

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Insurance not found'
      });
    }

    return res.json({
      success: true,
      message: 'Insurance updated successfully',
      data: insurance
    });
  } catch (error) {
    console.error('Update Insurance Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * DELETE INSURANCE
 * =====================================================
 */
exports.remove = async (req, res) => {
  try {
    const insurance = await Insurance.findByIdAndDelete(req.params.id);

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Insurance not found'
      });
    }

    return res.json({
      success: true,
      message: 'Insurance deleted successfully'
    });
  } catch (error) {
    console.error('Delete Insurance Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * IMPORT INSURANCES FROM CSV/XLSX
 * =====================================================
 */
exports.importFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please attach a CSV or XLSX file.'
      });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message: 'Uploaded file contains no sheet data.'
      });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const data = mapRowToInsurance(rows[index]);
      if (Object.keys(data).length === 0) {
        results.skipped += 1;
        continue;
      }

      const query = {};
      if (data.policyNumber) query.policyNumber = data.policyNumber;
      else if (data.insurancePolicy) query.insurancePolicy = data.insurancePolicy;
      else if (data.insuranceIdNumber) query.insuranceIdNumber = data.insuranceIdNumber;

      try {
        if (Object.keys(query).length > 0) {
          const existing = await Insurance.findOne(query);
          if (existing) {
            await Insurance.findByIdAndUpdate(existing._id, data, { new: true, runValidators: true });
            results.updated += 1;
            continue;
          }
        }

        await Insurance.create(data);
        results.created += 1;
      } catch (error) {
        results.errors.push({ row: rowNumber, message: error.message });
      }
    }

    return res.json({
      success: true,
      message: 'Insurance import completed',
      data: results
    });
  } catch (error) {
    console.error('Import Insurance Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
