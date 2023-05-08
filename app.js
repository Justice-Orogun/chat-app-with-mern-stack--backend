const express = require("express");
const morgan = require("morgan");

const connectDB = require("./helpers/connectDB");
const conversationsRouter = require("./router/conversationsRouter");
const messagesRouter = require("./router/messagesRouter");
const usersRouter = require("./router/usersRouter");

const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

require("dotenv").config();

app.use(express.json());
app.use(morgan("common"));

app.use("/api/v1/conversations", conversationsRouter);
app.use("/api/v1/messages", messagesRouter);
app.use("/api/v1/users", usersRouter);

io.on("connection", (socket) => {
  console.log("CONNECTION WORKING");

  socket.emit("message", {
    name: "James Serengia",
  });
});

// connect DB
connectDB();

const PORT = process.env.PORT || 8001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ...`);
});
