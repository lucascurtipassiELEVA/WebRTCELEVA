// Configuração do WebRTC com signaling real
class WebRTCApp {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.roomId = null;
        this.isCallStarted = false;
        this.socket = null;
        this.remoteUserId = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.showRoomModal();
    }

    initializeElements() {
        // Elementos de vídeo
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        
        // Botões de controle
        this.startCallBtn = document.getElementById('startCall');
        this.shareScreenBtn = document.getElementById('shareScreen');
        this.toggleAudioBtn = document.getElementById('toggleAudio');
        this.toggleVideoBtn = document.getElementById('toggleVideo');
        this.endCallBtn = document.getElementById('endCall');
        
        // Elementos de chat
        this.messageInput = document.getElementById('messageInput');
        this.sendMessageBtn = document.getElementById('sendMessage');
        this.chatMessages = document.getElementById('chatMessages');
        
        // Modal e elementos de sala
        this.roomModal = document.getElementById('roomModal');
        this.roomIdInput = document.getElementById('roomId');
        this.joinRoomBtn = document.getElementById('joinRoom');
        this.createRoomBtn = document.getElementById('createRoom');
        
        // Elementos de status
        this.roomStatus = document.getElementById('roomStatus');
        this.connectionStatus = document.getElementById('connectionStatus');
    }

    setupEventListeners() {
        // Controles de mídia
        this.startCallBtn.addEventListener('click', () => this.startCall());
        this.shareScreenBtn.addEventListener('click', () => this.shareScreen());
        this.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
        this.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
        this.endCallBtn.addEventListener('click', () => this.endCall());
        
        // Chat
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Sala
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
    }

    showRoomModal() {
        this.roomModal.style.display = 'flex';
    }

    hideRoomModal() {
        this.roomModal.style.display = 'none';
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    createRoom() {
        this.roomId = this.generateRoomId();
        this.roomIdInput.value = this.roomId;
        this.joinRoom();
    }

    joinRoom() {
        const roomId = this.roomIdInput.value.trim();
        if (!roomId) {
            alert('Por favor, digite um ID de sala válido');
            return;
        }
        
        this.roomId = roomId;
        
        // Conectar ao servidor de signaling
        this.socket = io();
        
        // Configurar listeners do socket
        this.setupSocketListeners();
        
        // Entrar na sala
        this.socket.emit('join-room', this.roomId);
        
        this.hideRoomModal();
        this.roomStatus.textContent = `Sala: ${this.roomId}`;
        this.connectionStatus.textContent = 'Conectado à sala';
        this.connectionStatus.style.color = 'green';
        
        // Habilitar controles
        this.startCallBtn.disabled = false;
        this.messageInput.disabled = false;
        this.sendMessageBtn.disabled = false;
        
        this.addMessage('system', 'Você entrou na sala de conferência. Aguardando participantes...');
    }

    setupSocketListeners() {
        this.socket.on('user-connected', (userId) => {
            this.addMessage('system', `Usuário ${userId} conectado. Iniciando chamada...`);
            this.remoteUserId = userId;
            
            // Se já temos nossa mídia local, iniciar a oferta
            if (this.localStream) {
                this.createPeerConnection();
                this.sendOffer();
            } else {
                this.startCall();
            }
        });
        
        this.socket.on('user-disconnected', (userId) => {
            if (userId === this.remoteUserId) {
                this.addMessage('system', 'O participante desconectou');
                this.connectionStatus.textContent = 'Participante desconectado';
                this.connectionStatus.style.color = 'orange';
                
                // Limpar stream remoto
                this.remoteVideo.srcObject = null;
                this.remoteUserId = null;
                
                // Redefinir UI
                this.shareScreenBtn.disabled = true;
                this.toggleAudioBtn.disabled = true;
                this.toggleVideoBtn.disabled = true;
            }
        });
        
        this.socket.on('offer', async (data) => {
            this.addMessage('system', 'Recebendo solicitação de chamada...');
            this.remoteUserId = data.sender;
            
            if (!this.localStream) {
                await this.startCall();
            }
            
            if (!this.peerConnection) {
                this.createPeerConnection();
            }
            
            // Processar a oferta recebida
            await this.peerConnection.setRemoteDescription(data.offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // Enviar resposta
            this.socket.emit('answer', {
                target: this.remoteUserId,
                answer: answer
            });
        });
        
        this.socket.on('answer', async (data) => {
            this.addMessage('system', 'Chamada aceita pelo participante');
            await this.peerConnection.setRemoteDescription(data.answer);
        });
        
        this.socket.on('ice-candidate', async (data) => {
            try {
                await this.peerConnection.addIceCandidate(data.candidate);
            } catch (e) {
                console.error('Erro ao adicionar ICE candidate:', e);
            }
        });
    }

    async startCall() {
        try {
            // Solicitar acesso à câmera e microfone
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            // Exibir vídeo local
            this.localVideo.srcObject = this.localStream;
            
            // Se já temos um usuário remoto, iniciar a oferta
            if (this.remoteUserId && !this.peerConnection) {
                this.createPeerConnection();
                this.sendOffer();
            }
            
            // Atualizar UI
            this.startCallBtn.disabled = true;
            this.shareScreenBtn.disabled = false;
            this.toggleAudioBtn.disabled = false;
            this.toggleVideoBtn.disabled = false;
            this.endCallBtn.disabled = false;
            
            this.isCallStarted = true;
            this.addMessage('system', 'Chamada iniciada com sucesso');
            
        } catch (error) {
            console.error('Erro ao acessar a câmera/microfone:', error);
            this.addMessage('system', 'Erro ao acessar câmera/microfone. Verifique as permissões.');
        }
    }

    createPeerConnection() {
        // Configuração dos servidores STUN
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.peerConnection = new RTCPeerConnection(configuration);
        
        // Adicionar stream local à conexão
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });
        
        // Manipular stream remoto
        this.peerConnection.ontrack = (event) => {
            this.remoteVideo.srcObject = event.streams[0];
            this.remoteStream = event.streams[0];
            this.connectionStatus.textContent = 'Conectado com participante';
            this.connectionStatus.style.color = 'green';
            this.addMessage('system', 'Conexão estabelecida com participante');
        };
        
        // Manipular candidatos ICE
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.remoteUserId) {
                this.socket.emit('ice-candidate', {
                    target: this.remoteUserId,
                    candidate: event.candidate
                });
            }
        };
        
        // Manipular mudanças de estado da conexão
        this.peerConnection.onconnectionstatechange = () => {
            switch(this.peerConnection.connectionState) {
                case 'connected':
                    this.connectionStatus.textContent = 'Conectado com participante';
                    this.connectionStatus.style.color = 'green';
                    break;
                case 'disconnected':
                case 'failed':
                    this.connectionStatus.textContent = 'Problema na conexão';
                    this.connectionStatus.style.color = 'red';
                    break;
            }
        };
    }

    async sendOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.socket.emit('offer', {
                target: this.remoteUserId,
                offer: offer
            });
            
            this.addMessage('system', 'Solicitação de chamada enviada');
        } catch (error) {
            console.error('Erro ao criar oferta:', error);
            this.addMessage('system', 'Erro ao iniciar chamada');
        }
    }

    async shareScreen() {
        try {
            // Solicitar acesso à tela
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });
            
            // Encontrar o track de vídeo atual
            const videoSender = this.peerConnection.getSenders()
                .find(sender => sender.track && sender.track.kind === 'video');
            
            if (videoSender) {
                // Substituir o track da câmera pelo track da tela
                await videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
            }
            
            this.addMessage('system', 'Compartilhamento de tela iniciado');
            
            // Restaurar a câmera quando o compartilhamento for interrompido
            screenStream.getVideoTracks()[0].onended = async () => {
                if (this.isCallStarted && this.localStream) {
                    const cameraTrack = this.localStream.getVideoTracks()[0];
                    if (videoSender && cameraTrack) {
                        await videoSender.replaceTrack(cameraTrack);
                    }
                    this.addMessage('system', 'Compartilhamento de tela finalizado');
                }
            };
            
        } catch (error) {
            console.error('Erro ao compartilhar tela:', error);
            this.addMessage('system', 'Erro ao compartilhar tela');
        }
    }

    toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.toggleAudioBtn.textContent = audioTrack.enabled ? 'Mudo' : 'Ativar Áudio';
                this.addMessage('system', `Áudio ${audioTrack.enabled ? 'ativado' : 'desativado'}`);
            }
        }
    }

    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.toggleVideoBtn.textContent = videoTrack.enabled ? 'Vídeo' : 'Ativar Vídeo';
                this.addMessage('system', `Vídeo ${videoTrack.enabled ? 'ativado' : 'desativado'}`);
            }
        }
    }

    endCall() {
        // Parar todas as tracks de mídia
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        // Fechar conexão peer
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Limpar os elementos de vídeo
        this.localVideo.srcObject = null;
        this.remoteVideo.srcObject = null;
        
        // Redefinir a interface do usuário
        this.startCallBtn.disabled = false;
        this.shareScreenBtn.disabled = true;
        this.toggleAudioBtn.disabled = true;
        this.toggleVideoBtn.disabled = true;
        this.endCallBtn.disabled = true;
        
        // Redefinir textos dos botões
        this.toggleAudioBtn.textContent = 'Mudo';
        this.toggleVideoBtn.textContent = 'Vídeo';
        
        // Atualizar status
        this.connectionStatus.textContent = 'Chamada finalizada';
        this.connectionStatus.style.color = 'red';
        
        this.isCallStarted = false;
        this.remoteUserId = null;
        
        this.addMessage('system', 'Chamada finalizada');
        
        // Desconectar do socket se desejar
        // if (this.socket) {
        //     this.socket.disconnect();
        // }
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (message) {
            this.addMessage('self', message);
            this.messageInput.value = '';
            
            // Em um app real, você enviaria a mensagem via socket para o outro usuário
            // Simulando recebimento de resposta após 1 segundo
            setTimeout(() => {
                this.addMessage('remote', 'Mensagem recebida com sucesso!');
            }, 1000);
        }
    }

    addMessage(type, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type);
        
        const timestamp = new Date().toLocaleTimeString();
        messageDiv.textContent = `${timestamp} - ${text}`;
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

// Inicializar a aplicação quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new WebRTCApp();
});