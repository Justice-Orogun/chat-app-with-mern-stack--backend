const express = require("express");
const messageController = require("../controllers/messageController");

const router = express.Router();

router.route("/").post(messageController.createMessage);
router.route("/:conversationId").get(messageController.getMessagesByUser);

module.exports = router;
