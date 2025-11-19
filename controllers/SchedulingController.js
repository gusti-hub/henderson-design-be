// controllers/schedulingController.js
const Appointment = require('../models/Appointment');
const AvailabilityConfig = require('../models/AvailabilityConfig');
const NextStepsOption = require('../models/NextStepsOption');

const sendEmail = require('../utils/sendEmail');
const {
  appointmentClientTemplate,
  appointmentAdminTemplate
} = require('../utils/appointmentEmailTemplates');

const { getDayOfWeek, addDays } = require('../utils/date');

// ========================
// BLOCKED DATES & TIMES
// ========================

// Full-day blocked dates (YYYY-MM-DD)
const BLOCKED_DATES = new Set([
  "2025-11-27",
  "2025-11-28",

  "2025-12-22",
  "2025-12-23",
  "2025-12-24",
  "2025-12-25",
  "2025-12-26",
  "2025-12-29",
  "2025-12-30",
  "2025-12-31",

  "2026-01-01",
  "2026-01-02",
  "2026-01-05"
]);

// Partial block per time slot
// Wednesday 26 – 1:00, 3:00 → 13:00 & 15:00
const PARTIAL_BLOCKED_SLOTS = {
  "2025-11-26": new Set(["13:00", "15:00"])
};

function isBlockedDate(dateStr) {
  return BLOCKED_DATES.has(dateStr);
}

function isBlockedSlot(dateStr, timeStr) {
  const blockedTimes = PARTIAL_BLOCKED_SLOTS[dateStr];
  if (!blockedTimes) return false;
  return blockedTimes.has(timeStr);
}


// ========================
// Ensure Friday exists
// ========================
async function getActiveConfig() {
  let cfg = await AvailabilityConfig.findOne({ isActive: true });

  if (!cfg) {
    cfg = await AvailabilityConfig.create({
      availableDays: [1, 2, 3, 4, 5],
      timeSlots: ['11:00', '13:00', '15:00'],
      durationOptions: [30, 45, 60],
      defaultDuration: 45,
      timeZone: 'Pacific/Honolulu',
      minDaysInAdvance: 1,
      maxDaysInAdvance: 60,
      bufferTime: 15,
      isActive: true
    });
    return cfg;
  }

  // guarantee Friday
  if (!cfg.availableDays.includes(5)) {
    cfg.availableDays.push(5);
    cfg.availableDays.sort();
    await cfg.save();
  }

  return cfg;
}

// ========================
// GET CONFIG
// ========================
const getAvailabilityConfig = async (req, res) => {
  try {
    const cfg = await getActiveConfig();
    res.json({ success: true, data: cfg });
  } catch (err) {
    console.error('Get config error:', err);
    res.status(500).json({ success: false, message: 'Failed to get config' });
  }
};


// ========================
// GET AVAILABLE DATES
// ========================
const getAvailableDates = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const cfg = await getActiveConfig();

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD string
    let current = addDays(today, cfg.minDaysInAdvance);
    const end = addDays(today, Math.min(parseInt(days), cfg.maxDaysInAdvance));

    const results = [];

    while (current <= end) {
      // 🚫 Skip if full-day blocked
      if (isBlockedDate(current)) {
        current = addDays(current, 1);
        continue;
      }

      const weekday = getDayOfWeek(current); // 0=Sun

      if (cfg.availableDays.includes(weekday)) {
        // Ambil semua slot untuk hari itu
        const rawSlots = await Appointment.getAvailableSlots(current);

        // Filter slot yang tidak diblok
        const availableSlots = rawSlots.filter(
          (t) => !isBlockedSlot(current, t)
        );

        if (availableSlots.length > 0) {
          results.push({
            date: current,
            dayOfWeek: weekday,
            availableSlotsCount: availableSlots.length
          });
        }
      }

      current = addDays(current, 1);
    }

    res.json({ success: true, data: results });

  } catch (err) {
    console.error('Get available dates error:', err);
    res.status(500).json({ success: false, message: 'Failed to get available dates' });
  }
};




// ========================
// GET AVAILABLE SLOTS
// ========================
const getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }

    // 🚫 Full-day blocked date → langsung tolak
    if (isBlockedDate(date)) {
      return res.status(400).json({
        success: false,
        message: 'This date is blocked for appointments'
      });
    }

    const cfg = await getActiveConfig();

    const weekday = getDayOfWeek(date);

    if (!cfg.availableDays.includes(weekday)) {
      return res.status(400).json({
        success: false,
        message: "Day not available"
      });
    }

    // Ambil slot mentah dari DB / Appointment model
    const rawSlots = await Appointment.getAvailableSlots(date);

    // Filter slot yang tidak diblok (partial)
    const availableSlots = rawSlots.filter(
      (t) => !isBlockedSlot(date, t)
    );

    res.json({
      success: true,
      date,
      count: availableSlots.length,
      data: availableSlots.map(t => ({
        time: t,
        displayTime: t,
        durationOptions: cfg.durationOptions,
        defaultDuration: cfg.defaultDuration
      }))
    });

  } catch (err) {
    console.error("Get available slots error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};





// @desc Book an appointment + save Next Steps option
// @route POST /api/scheduling/book
// @access Public
const bookAppointment = async (req, res) => {
  try {
    const {
      // Next Steps + contact info
      clientName,
      clientEmail,
      clientPhone,
      unitNumber,
      optionType,      // 'lock-price' | 'design-fee' | 'questions'
      clientNotes,

      // Scheduling info
      appointmentDate, // "YYYY-MM-DD" (string)
      appointmentTime, // "11:00" | "13:00" | "15:00"
      duration         // optional, default from config
    } = req.body;

    // ============================
    // BASIC VALIDATION
    // ============================
    if (
      !clientName ||
      !clientEmail ||
      !unitNumber ||
      !appointmentDate ||
      !appointmentTime ||
      !optionType
    ) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, unit number, option, date, and time are required'
      });
    }

    const validOptions = ['lock-price', 'design-fee', 'questions'];
    if (!validOptions.includes(optionType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid option type'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // ============================
    // HOLIDAY / BLOCKED DATE & TIME CHECK
    // ============================
    if (isBlockedDate(appointmentDate) || isBlockedSlot(appointmentDate, appointmentTime)) {
      return res.status(400).json({
        success: false,
        message: 'Selected date and time are not available. Please choose another schedule.'
      });
    }

    // ============================
    // LOAD CONFIG + VALIDASI HARI
    // ============================
    const cfg = await getActiveConfig(); // pastikan Friday termasuk
    const weekday = getDayOfWeek(appointmentDate); // 0=Sun..6=Sat (pure UTC)

    if (!cfg.availableDays.includes(weekday)) {
      return res.status(400).json({
        success: false,
        message: 'Selected day is not available for appointments'
      });
    }

    // ============================
    // CEK SLOT MASIH KOSONG
    // ============================
    const isAvailable = await Appointment.isSlotAvailable(appointmentDate, appointmentTime);
    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        message: 'This time slot has already been booked. Please select another time.'
      });
    }

    // ============================
    // SIMPAN / UPDATE NEXT STEPS OPTION (RINGKAS)
    // ============================
    let submission;

    try {
      submission = await NextStepsOption.findOne({
        email: clientEmail.toLowerCase(),
        unitNumber: unitNumber.trim()
      });

      if (submission) {
        // Update existing submission
        submission.name = clientName.trim();
        submission.phone = clientPhone?.trim() || '';
        submission.selectedOption = optionType;
        submission.notes = clientNotes?.trim() || '';
        submission.status = 'scheduled';
        submission.followUpDate = appointmentDate;
        submission.followUpNotes = `Appointment scheduled at ${appointmentTime}`;
        await submission.save();

        console.log(`📝 Updated existing NextStepsOption: ${submission._id}`);
      } else {
        // Create new submission (simple)
        submission = await NextStepsOption.create({
          name: clientName.trim(),
          email: clientEmail.toLowerCase(),
          phone: clientPhone?.trim() || '',
          unitNumber: unitNumber.trim(),
          selectedOption: optionType,
          notes: clientNotes?.trim() || '',
          status: 'scheduled',
          submissionSource: 'next-steps-page',
          followUpDate: appointmentDate,
          followUpNotes: `Appointment scheduled at ${appointmentTime}`,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent')
        });

        console.log(`✨ Created new NextStepsOption: ${submission._id}`);
      }
    } catch (err) {
      console.error('⚠️ Failed to save NextStepsOption (non-blocking):', err.message);
      // jangan gagalkan booking kalau NextStepsOption gagal,
      // tapi log saja
    }

    // ============================
    // BUAT APPOINTMENT
    // ============================
    const appointment = await Appointment.create({
      clientName: clientName.trim(),
      clientEmail: clientEmail.toLowerCase().trim(),
      clientPhone: clientPhone?.trim() || '',
      unitNumber: unitNumber.trim(),
      appointmentDate,      // string "YYYY-MM-DD"
      appointmentTime,
      duration: duration || cfg.defaultDuration,
      timeZone: cfg.timeZone,
      optionType,
      nextStepsSubmissionId: submission ? submission._id : null,
      clientNotes: clientNotes?.trim() || '',
      status: 'scheduled',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    });

    console.log(`✅ Appointment created: ${appointment._id}`);

    const formattedDate = appointmentDate;
    const formattedTime = appointmentTime;

    // ============================
    // KIRIM EMAIL KE CLIENT
    // ============================
    try {
      const clientHTML = appointmentClientTemplate({
        clientName,
        clientEmail,
        unitNumber,
        appointmentDate: formattedDate,
        appointmentTime: formattedTime,
        duration: duration || cfg.defaultDuration,
        optionType,
        clientNotes: clientNotes || ''
      });

      await sendEmail({
        to: clientEmail,
        toName: clientName,
        subject: '✅ Your Appointment is Confirmed - Henderson Design Group',
        htmlContent: clientHTML
      });

      console.log(`📧 Client appointment email sent → ${clientEmail}`);
    } catch (err) {
      console.error('❌ Failed to send client appointment email:', err.message);
    }

    // ============================
    // KIRIM EMAIL KE ADMIN
    // ============================
    try {
      const adminEmails = (process.env.ADMIN_EMAIL ||
        'gustianggara@henderson.house;almer@henderson.house;madeline@henderson.house')
        .split(/[;,]+/)
        .map(e => e.trim())
        .filter(e => e.length > 0);

      const adminHTML = appointmentAdminTemplate({
        clientName,
        clientEmail,
        clientPhone: clientPhone || 'Not provided',
        unitNumber,
        appointmentDate: formattedDate,
        appointmentTime: formattedTime,
        duration: duration || cfg.defaultDuration,
        optionType,
        clientNotes: clientNotes || '',
        submittedAt: new Date().toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      for (const adminEmail of adminEmails) {
        try {
          await sendEmail({
            to: adminEmail,
            toName: 'Henderson Admin',
            subject: `📅 New Appointment: ${clientName} - ${formattedDate} at ${formattedTime}`,
            htmlContent: adminHTML
          });
          console.log(`📧 Admin appointment email sent → ${adminEmail}`);
        } catch (err) {
          console.error(`⚠️ Failed to send admin email to ${adminEmail}:`, err.message);
        }
      }

    } catch (err) {
      console.error('❌ Admin email block error:', err.message);
    }

    // ============================
    // RESPONSE KE FRONTEND
    // ============================
    return res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: {
        appointmentId: appointment._id,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        duration: appointment.duration,
        status: appointment.status,
        optionType: appointment.optionType,
        nextStepsSubmissionId: appointment.nextStepsSubmissionId
      }
    });

  } catch (error) {
    console.error('❌ Book appointment error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This time slot has already been booked. Please select another time.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to book appointment. Please try again.'
    });
  }
};



// ========================
// GET APPOINTMENT
// ========================
const getAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id).populate('nextStepsSubmissionId');
    if (!appt) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.json({ success: true, data: appt });

  } catch (err) {
    console.error('Get appointment error:', err);
    res.status(500).json({ success: false, message: 'Failed to get appointment' });
  }
};


// ========================
// CANCEL APPOINTMENT
// ========================
const cancelAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    appt.status = 'cancelled';
    appt.adminNotes = req.body.reason || "Cancelled";
    await appt.save();

    res.json({ success: true, data: appt });

  } catch (err) {
    console.error('Cancel appointment error:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel appointment' });
  }
};

module.exports = {
  getAvailabilityConfig,
  getAvailableDates,
  getAvailableSlots,
  bookAppointment,
  getAppointment,
  cancelAppointment
};
