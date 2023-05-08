const AppErrorHandler = require("../helpers/AppErrorHandler");

const castErrorHandlerDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppErrorHandler(message, 400);
};

const duplicateValueErrorDB = (err) => {
  const value = err.errmsg.match(/(["'])(?:(?=(\\?))\2.)*?\1/)[0];

  const message = `Duplicate value: ${value}. Please use another value.`;
  return new AppErrorHandler(message, 400);
};

const validationErrorMongoose = (err) => {
  const message = err.message;
  return new AppErrorHandler(message, 400);
};

const jsonWebTokenError = () =>
  new AppErrorHandler("Invalid token. Please login again.", 401);

const tokenExpiredErrorHandler = () =>
  new AppErrorHandler("Token expired. Please login again.", 401);

// SEND PRODUCTION ERRORS FUNCTION
const sendProductionErrors = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Console error for Developer
    console.log("ERROR FROM GLOBAL ERROR HANDLER 🧯🧯");
    console.log(err);

    // Send generic error to client
    res.status(500).json({
      status: "error",
      message: "Something went very wrong",
    });
  }
};

// SEND DEVELOPMENT ERRORS FUNCTION
const sendDevelopmentErrors = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    stack: err.stack,
    err,
  });
};

module.exports = (err, req, res, next) => {
  // const err = { ...error };

  // eslint-disable-next-line no-param-reassign
  err.statusCode = err.statusCode || 500;
  // eslint-disable-next-line no-param-reassign
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "DEVELOPMENT") {
    // DEVELOPMENT ERROR - HANDLER
    // console.log("TESTING 🧯🧯🧯", err.name);
    sendDevelopmentErrors(err, res);
  } else if (process.env.NODE_ENV === "PRODUCTION") {
    // PRODUCTION ERROR HANDLER
    // let error = { ...err };
    if (err.name === "CastError") {
      // eslint-disable-next-line no-param-reassign
      err = castErrorHandlerDB(err);
    } else if (err.code === 11000) {
      // eslint-disable-next-line no-param-reassign
      err = duplicateValueErrorDB(err);
    } else if (err.name === "ValidationError") {
      // eslint-disable-next-line no-param-reassign
      err = validationErrorMongoose(err);
    } else if (err.name === "JsonWebTokenError") {
      // eslint-disable-next-line no-param-reassign
      err = jsonWebTokenError();
    } else if (err.name === "TokenExpiredError") {
      // eslint-disable-next-line no-param-reassign
      err = tokenExpiredErrorHandler();
    }

    sendProductionErrors(err, res);
  }

  next();
};
