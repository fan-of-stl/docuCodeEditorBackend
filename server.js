const express = require("express");
const dotenv = require("dotenv");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const ACTIONS = require("./Actions");

dotenv.config();

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {};

function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
}

io.on("connection", (socket) => {
  console.log("a new client connected", socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;

    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);

    // Emit to all clients EXCEPT the newly joined one
    socket.broadcast.to(roomId).emit(ACTIONS.JOINED, {
      clients,
      username,
      socketId: socket.id,
    });

    // Emit directly to the newly joined client to update their own client list
    socket.emit(ACTIONS.JOINED, { clients, username, socketId: socket.id });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    console.log(code, roomId);
    
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
});

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];

    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });

    delete userSocketMap[socket.id];

    socket.leave();
  });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});
