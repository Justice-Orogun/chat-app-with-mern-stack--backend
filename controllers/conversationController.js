const AppErrorHandler = require("../helpers/AppErrorHandler");
const Conversation = require("../models/Conversation");

exports.postConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.create({
      members: [req.body.senderId, req.body.receiverId],
    });

    res.status(201).json({
      status: "success",
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

exports.getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      members: { $in: [req.params.userId] },
    });

    res.status(200).json({
      status: "success",
      data: {
        conversations,
      },
    });
  } catch (error) {
    next(error);
  }
};
