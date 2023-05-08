const Conversation = require("../models/Conversation");

exports.postConversation = async (req, res) => {
  try {
    const conversation = await Conversation.create({
      members: [req.body.senderId, req.body.receiverId],
    });

    res.status(201).json({
      status: "success",
      data: conversation,
    });
  } catch (error) {
    res.status(500).json({
      status: "fail",
      message: "Something went wrong",
    });
  }
};
