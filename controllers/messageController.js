const Message = require("../models/Message");

exports.createMessage = async (req, res, next) => {
  try {
    const messages = await Message.create(req.body);
    res.status(200).json({
      status: "success",
      data: {
        messages,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMessagesByUser = async (req, res, next) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId,
    });
    res.status(200).json({
      status: "success",
      data: {
        messages,
      },
    });
  } catch (error) {
    next(error);
  }
};
