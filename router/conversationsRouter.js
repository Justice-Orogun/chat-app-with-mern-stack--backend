const express = require("express");
const conversationController = require("../controllers/conversationController");
const router = express.Router();
router.route("/", conversationController.postConversation);

module.exports = router;
