const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

/**
 * Admin Schema
 * Stores admin credentials with bcrypt-hashed passwords.
 */
const userchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    role: {
      type: String,
      default: 'admin',
      enum: ['admin', 'superadmin'],
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

/**
 * Pre-save hook: hash the password before saving if it was modified.
 * This ensures passwords are NEVER stored in plain text.
 */
userchema.pre('save', async function (next) {
  // Only hash if the password field was modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Instance method: compare a candidate password with the stored hash.
 * @param {string} candidatePassword - The plain-text password to verify.
 * @returns {Promise<boolean>} True if the password matches.
 */
userchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Remove password from JSON output for safety.
 */
userchema.methods.toJSON = function () {
  const admin = this.toObject();
  delete admin.password;
  return admin;
};

const User = mongoose.model('Admin', userchema);

module.exports = User;
