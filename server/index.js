const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const rooms = Object.create(null);

// Create an empty game board
function createBoard() {
  return Array.from({ length: 6 }, () => Array(7).fill(0));
}

// Check for a winner
function checkWinner(board, player) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      if (board[row][col] !== player) {
        continue;
      }

      for (const [dr, dc] of directions) {
        let count = 1;

        for (let i = 1; i < 4; i++) {
          const newRow = row + dr * i;
          const newCol = col + dc * i;

          if (
            newRow >= 0 &&
            newRow < 6 &&
            newCol >= 0 &&
            newCol < 7 &&
            board[newRow][newCol] === player
          ) {
            count++;
          } else {
            break;
          }
        }

        if (count === 4) {
          return true;
        }
      }
    }
  }

  return false;
}

// Check for a draw
function checkDraw(board) {
  return board.every((row) => row.every((cell) => cell !== 0));
}

// Validate room codes
function isValidRoomCode(roomCode) {
  return typeof roomCode === "string" && /^[A-Z0-9]{6}$/.test(roomCode);
}

// Check whether a player is already in a room
function isPlayerInRoom(socketId) {
  return Object.values(rooms).some((room) => room.players.includes(socketId));
}

// Handle socket connections
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Create a room
  socket.on("createRoom", () => {
    if (isPlayerInRoom(socket.id)) {
      socket.emit("roomError", "You are already in a room");
      return;
    }

    let roomCode;

    do {
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (rooms[roomCode] || roomCode.length !== 6);

    rooms[roomCode] = {
      board: createBoard(),
      players: [socket.id],
      currentPlayer: 1,
      winner: null,
      isDraw: false,
    };

    socket.join(roomCode);

    socket.emit("roomCreated", {
      roomCode,
      player: 1,
    });

    console.log("Room created:", roomCode);
  });

  // Join an existing room
  socket.on("joinRoom", (roomCode) => {
    if (isPlayerInRoom(socket.id)) {
      socket.emit("roomError", "You are already in a room");
      return;
    }

    if (!isValidRoomCode(roomCode)) {
      socket.emit("roomError", "Invalid room code");
      return;
    }

    const room = rooms[roomCode];

    if (!room) {
      socket.emit("roomError", "Room does not exist");
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("roomError", "Room is full");
      return;
    }

    room.players.push(socket.id);

    socket.join(roomCode);

    socket.emit("roomJoined", {
      roomCode,
      player: 2,
    });

    io.to(roomCode).emit("gameUpdate", room);

    console.log("Player joined room:", roomCode);
  });

  // Handle player moves
  socket.on("dropPiece", (data) => {
    if (!data || typeof data !== "object") {
      return;
    }

    const { roomCode, colIndex } = data;

    if (!isValidRoomCode(roomCode)) {
      return;
    }

    const room = rooms[roomCode];

    if (!room) {
      return;
    }

    if (room.players.length !== 2) {
      return;
    }

    if (room.winner !== null || room.isDraw) {
      return;
    }

    const player = room.players.indexOf(socket.id) + 1;

    if (player !== room.currentPlayer) {
      return;
    }

    if (!Number.isInteger(colIndex) || colIndex < 0 || colIndex >= 7) {
      return;
    }

    for (let row = 5; row >= 0; row--) {
      if (room.board[row][colIndex] === 0) {
        room.board[row][colIndex] = player;

        if (checkWinner(room.board, player)) {
          room.winner = player;
        } else if (checkDraw(room.board)) {
          room.isDraw = true;
        } else {
          room.currentPlayer = player === 1 ? 2 : 1;
        }

        io.to(roomCode).emit("gameUpdate", room);

        break;
      }
    }
  });

  // Restart a multiplayer game
  socket.on("resetGame", (roomCode) => {
    if (!isValidRoomCode(roomCode)) {
      return;
    }

    const room = rooms[roomCode];

    if (!room) {
      return;
    }

    if (!room.players.includes(socket.id)) {
      return;
    }

    if (room.players.length !== 2) {
      return;
    }

    room.board = createBoard();
    room.currentPlayer = 1;
    room.winner = null;
    room.isDraw = false;

    io.to(roomCode).emit("gameUpdate", room);

    console.log("Game restarted:", roomCode);
  });

  // Handle a player voluntarily leaving a room
  socket.on("leaveRoom", (roomCode) => {
    if (!isValidRoomCode(roomCode)) {
      return;
    }

    const room = rooms[roomCode];

    if (!room) {
      return;
    }

    if (!room.players.includes(socket.id)) {
      return;
    }

    socket.to(roomCode).emit("opponentDisconnected");

    socket.emit("roomLeft");

    io.in(roomCode).socketsLeave(roomCode);

    delete rooms[roomCode];

    console.log("Room deleted:", roomCode);
  });

  // Handle player disconnections
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);

    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      if (room.players.includes(socket.id)) {
        io.to(roomCode).emit("opponentDisconnected");

        io.in(roomCode).socketsLeave(roomCode);

        delete rooms[roomCode];

        console.log("Room deleted:", roomCode);
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
