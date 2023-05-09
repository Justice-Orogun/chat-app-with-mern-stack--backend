const express = require("express");
const conversationController = require("../controllers/conversationController");

const router = express.Router();

router.route("/").post(conversationController.postConversation);
router.route("/:userId").get(conversationController.getConversations);

module.exports = router;
