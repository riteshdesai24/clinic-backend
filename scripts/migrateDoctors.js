require('dotenv').config();
const mongoose = require('mongoose');

const Doctor = require('../models/Doctor'); // old
const User = require('../models/User');     // new

const bcrypt = require('bcrypt');

(async () => {
  try {

    await mongoose.connect(process.env.MONGO_URI);

    console.log('Connected...');

    const doctors = await Doctor.find();

    for (let d of doctors) {

      const exists = await User.findOne({ email: d.email });
      if (exists) continue;

      const hash = await bcrypt.hash('doctor@123', 10);

      await User.create({
        clinicId: d.clinicId,
        staffname: d.name,
        email: d.email,
        phone: d.phone,
        password: hash,
        role: 'DOCTOR',
        specialization: d.specialization,
        available: d.active
      });

      console.log(`Migrated: ${d.name}`);
    }

    console.log('Migration done ✅');
    process.exit();

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
