const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server);

require("dotenv").config();

// Your Express routes
app.get("/", (req, res) => {
  res.send("Hello, world!");
});

// Socket.io events
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// Start the server
const PORT = process.env.PORT || 8001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
