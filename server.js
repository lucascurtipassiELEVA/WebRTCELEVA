const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fornecer o arquivo Socket.io client
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

// Armazenamento de salas
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);

  // Entrar em uma sala
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    
    // Adicionar usuário à sala
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { users: [] });
    }
    
    const room = rooms.get(roomId);
    room.users.push(socket.id);
    
    // Notificar outros usuários na sala
    socket.to(roomId).emit('user-connected', socket.id);
    
    console.log(`Usuário ${socket.id} entrou na sala ${roomId}`);
  });

  // Oferecer sinalização WebRTC
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      sender: socket.id
    });
  });

  // Responder a oferta WebRTC
  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      sender: socket.id
    });
  });

  // Encaminhar candidatos ICE
  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  // Usuário desconectado
  socket.on('disconnect', () => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        // Remover usuário da sala
        room.users = room.users.filter(id => id !== socket.id);
        
        // Se a sala estiver vazia, removê-la
        if (room.users.length === 0) {
          rooms.delete(socket.roomId);
        } else {
          // Notificar outros usuários
          socket.to(socket.roomId).emit('user-disconnected', socket.id);
        }
      }
    }
    console.log('Usuário desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});