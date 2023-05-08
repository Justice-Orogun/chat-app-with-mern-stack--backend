/* eslint-disable camelcase */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const { _id: id, name, email, accountActivated, role, photo } = user;

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "PRODUCTION") {
    cookieOptions.secure = true;
  }
  res.cookie("jwt", token, cookieOptions);

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user: { id, name, email, accountActivated, role, photo },
    },
  });
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password, passwordConfirm } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: "fail",
        message:
          "The email is already taken. Please signup with a different email.",
      });
    }

    // Save unconfirmed user
    await User.create({
      name,
      email,
      password,
      passwordConfirm,
    });

    res.status(200).json({
      status: "success",
      data: {
        message: `Account created successfully.`,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "fail",
      message: "Something went wrong",
    });
  }
};

exports.login = async (req, res, next) => {
  try {
    //  1. Check is email and password exists
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide email and password",
      });
    }

    //  2. Check is email exists in DB
    const foundUser = await User.findOne({ email }).select("+password");

    const correct = await foundUser?.correctPassword(
      password,
      foundUser.password
    );

    if (!foundUser || !correct) {
      return next(new AppErrorHandler("Incorrect email or password.", 401));
    }

    if (foundUser && !foundUser.accountActivated) {
      // Trying to login with inactive account
      if (foundUser.accountActivationDeadline > Date.now()) {
        return next(
          new AppErrorHandler(
            `Please activate your account before logging in. Activation link was sent to: ${email} `,
            400
          )
        );
      }

      // Trying to login when account is not activated and activation link expired
      // Delete user to able them create a fresh account using their email
      if (foundUser.accountActivationDeadline < Date.now()) {
        await User.findOneAndDelete({ email });
        return next(
          new AppErrorHandler(
            "Your account activation link expired. Please register again.",
            400
          )
        );
      }
    }

    // 3. Login and send token
    createSendToken(foundUser, 200, res);
  } catch (error) {
    next(error);
  }
};

// Only necessary when using httpOnly because in such case you
// can't delete/manipulate httpsCookies with browser code
exports.logout = (req, res, next) => {
  res.cookie("jwt", "logged_out_dummy_key", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    status: "success",
    message: "Successfully logged out",
  });
};

exports.protect = async (req, res, next) => {
  try {
    //  Get token and check if it exist
    let token;
    if (
      // eslint-disable-next-line operator-linebreak
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
      console.log("🧯BEARER TRIGGERED");
    } else if (req.cookies.jwt) {
      console.log("🧯COOKIES JWT TRIGGERED");
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(
        new AppErrorHandler(
          "You are not logged in. Please log in to get access.",
          401
        )
      );
    }

    console.log("LETS CHECK TOKEN>", token);

    // Verify token
    // const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    let decoded;
    jwt.verify(token, process.env.JWT_SECRET, function (err, decodedObj) {
      decoded = decodedObj;

      if (err) {
        return next(
          new AppErrorHandler(
            "Invalid or expired token. Please log in again.",
            401
          )
        );
      }
    });

    // Check if the user exist
    const confirmedUser = await User.findById(decoded?.id);

    if (!confirmedUser) {
      return next(
        new AppErrorHandler(
          "The user belonging to that token no longer exist.",
          401
        )
      );
    }

    // Check if the user changed password after token was issued
    if (confirmedUser.passwordChangedAfter(decoded.iat)) {
      return next(
        new AppErrorHandler("User recently changed their password.", 401)
      );
    }

    // Grant access to the next middleware
    req.user = confirmedUser;
    next();
  } catch (error) {
    next(error);
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppErrorHandler(
          "You do no have permission to perform this action.",
          403
        )
      );
    }

    next();
  };
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return next(
        new AppErrorHandler("There is no user with that email.", 404)
      );
    }

    // Testing sms
    // sendSMS();

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // SEND EMAIL
    try {
      let resetURL;

      if (req.header("Referer")) {
        resetURL = `${req.header("Referer")}reset-password/${resetToken}`;
      } else {
        resetURL = `${req.protocol}//${req.get(
          "host"
        )}/api/v1/users/reset-password/${resetToken}`;
      }

      // Send welcome email
      await new Email(user, resetURL).sendPasswordReset();

      res.status(200).json({
        status: "success",
        message: "Reset token sent to your email.",
      });
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpired = undefined;
      await user.save({ validateBeforeSave: false });

      return next(
        new AppErrorHandler(
          "There was an error in trying to send your email. Please try again later.",
          500
        )
      );
    }
    // ////////
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    // Get user by hashed token
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    // Check if the passwordRestToken expired, only get user if it hasn't expired
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpired: { $gt: Date.now() },
    });

    if (!user) {
      return next(
        new AppErrorHandler(
          "Token is invalid or expired. Please try again.",
          400
        )
      );
    }

    // If reset token not expired and user found, reset password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetExpired = undefined;
    user.passwordResetToken = undefined;

    await user.save(); // IMPORTANT: Run validators

    // Log the user in, send JWT
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.updatePassword = async (req, res, next) => {
  try {
    // Find user, user has to login
    const user = await User.findById(req.user.id).select("+password");

    const passwordIsCorrect = await user.correctPassword(
      req.body.passwordCurrent,
      user.password
    );

    if (!passwordIsCorrect) {
      return next(
        new AppErrorHandler("Your current password is incorrect", 401)
      );
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.googleLogin = async (req, res, next) => {
  try {
    const client = new OAuth2Client(process.env.GOOGLE_AUTH_CLIENT_ID);
    const googleJWT = req.body.idToken;

    const response = await client.verifyIdToken({
      idToken: googleJWT,
      audience: process.env.GOOGLE_AUTH_CLIENT_ID,
    });

    // eslint-disable-next-line no-unused-vars
    const { email_verified, email, name, picture } = response.payload;

    if (!email_verified) {
      return next(
        new AppErrorHandler(
          "Your email is not verified. Please try with another email.",
          401
        )
      );
    }

    if (email_verified) {
      const user = await User.findOne({ email });

      if (user) {
        // Found an existing user, log them in
        return createSendToken(user, 200, res);
      }

      const password = email + signToken();
      const newUser = await User.create({
        name,
        email,
        password,
        passwordConfirm: password,
      });

      // Automatically activate their accounts
      const updatedUser = await User.findOneAndUpdate(
        { email },
        { accountActivated: true },
        { new: true }
      );

      // Send welcome email
      const url = `${req.protocol}://${req.get("host")}/me`;
      await new Email(updatedUser, url).sendWelcome();

      createSendToken(newUser, 200, res);
    }
  } catch (error) {
    next(error);
  }
};
