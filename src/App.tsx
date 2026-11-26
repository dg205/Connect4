import { useState, useEffect } from 'react';
import { socket } from './socket';
import './App.css';



function App() {
  const [board, setBoard] = useState(
    Array.from({ length: 6 }, () => Array(7).fill(0))
  );

  const [winner, setWinner] = useState<number | null>(null);

  const [isDraw, setIsDraw] = useState(false);

  const [currentPlayer, setCurrentPlayer] = useState(1);

  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [myPlayer, setMyPlayer] = useState<number | null>(null);
  const [roomError, setRoomError] = useState("");
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    function onConnect() {
      console.log("Connected to server", socket.id);
    }

    socket.on("connect", onConnect);

    if (socket.connected) {
      onConnect();
    };

    return () => {
      socket.off("connect", onConnect);
    };
  }, []);

  useEffect(() => {
  function onRoomCreated(data: {
    roomCode: string;
    player: number;
  }) {
    console.log("Room created response:", data);

    setRoomCode(data.roomCode);
    setMyPlayer(data.player);
    setRoomError("");
    setPlayerCount(1);
  }

  function onRoomJoined(data: {
    roomCode: string;
    player: number;
  }) {
    setRoomCode(data.roomCode);
    setMyPlayer(data.player);
    setRoomError("");
  }

  function onRoomError(message: string) {
    setRoomError(message);
  }

  function onGameUpdate(data: {
  board: number[][];
  currentPlayer: number;
  winner: number | null;
  isDraw: boolean;
  players: string[];
}) {
  setBoard(data.board);
  setCurrentPlayer(data.currentPlayer);
  setWinner(data.winner);
  setIsDraw(data.isDraw);
  setPlayerCount(data.players.length);
}

function onOpponentDisconnected() {
 resetRoomState("Your opponent disconnected.");
}

function resetRoomState(message: string) {
  setRoomCode("");
  setJoinCode("");
  setMyPlayer(null);
  setPlayerCount(0);

  setBoard(
    Array.from({ length: 6 }, () => Array(7).fill(0))
  );

  setCurrentPlayer(1);
  setWinner(null);
  setIsDraw(false);
  setRoomError(message);
}

function onDisconnect() {
  resetRoomState("You disconnected from the server.");
}

function onRoomLeft() {
  resetRoomState("You left the room.");
}

  socket.on("roomCreated", onRoomCreated);
  socket.on("roomJoined", onRoomJoined);
  socket.on("roomError", onRoomError);
  socket.on("gameUpdate", onGameUpdate);
  socket.on("opponentDisconnected", onOpponentDisconnected);
  socket.on("disconnect", onDisconnect);
  socket.on("roomLeft", onRoomLeft);

  return () => {
    socket.off("roomCreated", onRoomCreated);
    socket.off("roomJoined", onRoomJoined);
    socket.off("roomError", onRoomError);
    socket.off("gameUpdate", onGameUpdate);
    socket.off("opponentDisconnected", onOpponentDisconnected);
    socket.off("disconnect", onDisconnect);
    socket.off("roomLeft", onRoomLeft);
  };
}, []);

  function checkWinner(
    board: number[][],
    player: number
  ): boolean{
    const directions = [
      [0,1], // horizontal
      [1,0], // vertical
      [1,1], // diagonal down-right
      [1,-1] // diagonal down-left
    ];

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] !== player) {
          continue;
        }

        for (const [dr, dc] of directions) {
          let count =1;

          for (let i = 1; i < 4; i++){
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

  function checkDraw(board: number[][]): boolean {
    return board.every(row =>
      row.every(cell => cell !== 0)
    );
  }
  function dropPiece(colIndex: number) {

  if (roomCode !== "") {
  

  if (winner !== null || isDraw) {
    return;
  }

  socket.emit("dropPiece", {
    roomCode,
    colIndex
  });

  return;
}
    if (roomCode !== "" && playerCount < 2) {
  return;
}
    if (winner !== null || isDraw) {
      return;
    }
    const newBoard = board.map(row => [...row]);

    for (let row = 5; row >= 0; row--) {
      if (newBoard[row][colIndex] === 0) {
        newBoard[row][colIndex] = currentPlayer;

        setBoard(newBoard);
        if (checkWinner(newBoard, currentPlayer)) {
        setWinner(currentPlayer);
      } else if (checkDraw(newBoard)) {
        setIsDraw(true);
      } else {
        setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      }

        break;
      }
    }
  }

  function resetGame() {
  if (roomCode !== "") {
    socket.emit("resetGame", roomCode);
    return;
  }

  setBoard(
    Array.from({ length: 6 }, () => Array(7).fill(0))
  );

  setCurrentPlayer(1);
  setWinner(null);
  setIsDraw(false);
}

  function createRoom() {
  console.log("Create Room button clicked");
  console.log("Socket connected:", socket.connected);
  console.log("Socket ID:", socket.id);
  
  socket.emit("createRoom");
}

function joinRoom() {
  if (joinCode.trim() === "") {
    setRoomError("Please enter a room code");
    return;
  }

  socket.emit("joinRoom", joinCode.trim().toUpperCase());
}

function leaveRoom() {
  if (roomCode !== "") {
    socket.emit("leaveRoom", roomCode);
  }
}
    

  return (
    <div className="game">
      <h1>Connect Four</h1>
      {roomCode === "" ? (
  <div>
    <button onClick={createRoom}>
      Create Room
    </button>

    <input
      type="text"
      placeholder="Enter room code"
      value={joinCode}
      onChange={(e) => setJoinCode(e.target.value)}
      maxLength={6}
    />

    <button onClick={joinRoom}>
      Join Room
    </button>

    <p>{roomError}</p>
  </div>
) : (
  <div>
    <h2>Room Code: {roomCode}</h2>
    <p>You are Player {myPlayer}</p>
    <p>
    {playerCount < 2
      ? "Waiting for opponent..."
      : "Opponent connected!"}
  </p>

  <button onClick={leaveRoom}>
  Leave Room
</button>
  </div>
)}
      <p>{winner !== null
    ? `Player ${winner} wins!`
    : isDraw
    ? "It's a draw!"
    : `Player ${currentPlayer}'s turn`}</p>

      <div className={`board ${winner !== null || isDraw ? 'disabled' : ''}`}>
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`cell player-${cell}`}
              onClick={() => dropPiece(colIndex)}
            />
          ))
        )}
      </div>
      <button className="reset-button" onClick={resetGame}>
  Restart Game
</button>
    </div>
    
  );
}

export default App;