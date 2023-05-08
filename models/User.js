const mongoose = require("mongoose");
const crypto = require("crypto");
const validator = require("validator");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      min: 3,
      max: 20,
    },
    email: {
      type: String,
      required: true,
      max: 50,
      unique: true,
      validate: [validator.isEmail, "Please provide a valid email."],
    },
    password: {
      type: String,
      required: true,
      min: 6,
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: true,
      min: 6,
    },
    profilePicture: {
      type: String,
      default: "img/user-placeholder.img",
    },
    coverPicture: {
      type: String,
      default: "",
    },
    followers: {
      type: Array,
      default: [],
    },
    followings: {
      type: Array,
      default: [],
    },
    role: {
      type: String,
      default: "user",
      enum: ["user", "customer", "provider", "manager", "admin"],
    },
    desc: {
      type: String,
      max: 50,
    },
    city: {
      type: String,
      max: 50,
    },
    from: {
      type: String,
      max: 50,
    },
    relationship: {
      type: Number,
      enum: [1, 2, 3],
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpired: Date,
  },
  { timestamps: true }
);

// Encrypting password using a PRE-SAVE MIDDLEWARE
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
});

userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();

  // Small hack to ensure token issue time is always ahead of passwordChangedAt
  // to ensure user always logs in successfully when token is issued
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Verify password using INSTANCE METHOD
userSchema.methods.correctPassword = async function (
  candidatePassword,
  storedPassword
) {
  const status = await bcrypt.compare(candidatePassword, storedPassword);
  return status;
};

userSchema.methods.passwordChangedAfter = function (JWTTimeStamp) {
  if (this.passwordChangedAt) {
    const changedTime = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimeStamp < changedTime;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Encrypt token before saving to database
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpired = Date.now() + 10 * 60 * 1000;

  // Return plain token to send to client
  return resetToken;
};

module.exports = mongoose.model("User", userSchema);
