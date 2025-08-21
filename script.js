// Simulação de servidor WebRTC (para demonstração local)
// Em produção, você precisará de um servidor signaling real
class WebRTCApp {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.roomId = null;
        this.isCallStarted = false;
        
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
        this.hideRoomModal();
        this.roomStatus.textContent = `Sala: ${this.roomId}`;
        this.connectionStatus.textContent = 'Conectado';
        this.connectionStatus.style.color = 'green';
        
        // Habilitar controles
        this.startCallBtn.disabled = false;
        this.messageInput.disabled = false;
        this.sendMessageBtn.disabled = false;
        
        this.addMessage('system', 'Você entrou na sala de conferência');
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
            
            // Simular conexão com outro participante (apenas para demonstração)
            this.simulateRemoteConnection();
            
            // Atualizar UI
            this.startCallBtn.disabled = true;
            this.shareScreenBtn.disabled = false;
            this.toggleAudioBtn.disabled = false;
            this.toggleVideoBtn.disabled = false;
            
            this.isCallStarted = true;
            this.addMessage('system', 'Chamada iniciada com sucesso');
            
        } catch (error) {
            console.error('Erro ao acessar a câmera/microfone:', error);
            this.addMessage('system', 'Erro ao acessar câmera/microfone. Verifique as permissões.');
        }
    }

    simulateRemoteConnection() {
        // Simula a recepção de uma transmissão remota (apenas para demonstração)
        setTimeout(() => {
            this.connectionStatus.textContent = 'Conectado com 1 participante';
            this.addMessage('system', 'Outro participante entrou na chamada');
            
            // Simular recebimento de vídeo (usando placeholder)
            this.remoteVideo.srcObject = this.localStream;
        }, 2000);
    }

    async shareScreen() {
        try {
            // Solicitar acesso à tela
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });
            
            // Substituir o vídeo da câmera pelo compartilhamento de tela
            const videoTrack = screenStream.getVideoTracks()[0];
            const sender = this.peerConnection ? this.peerConnection.getSenders()
                .find(s => s.track && s.track.kind === 'video') : null;
            
            if (sender) {
                sender.replaceTrack(videoTrack);
            } else {
                this.localVideo.srcObject = screenStream;
            }
            
            this.addMessage('system', 'Compartilhamento de tela iniciado');
            
            // Restaurar a câmera quando o compartilhamento for interrompido
            videoTrack.onended = async () => {
                if (this.isCallStarted) {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    if (sender) {
                        const newVideoTrack = stream.getVideoTracks()[0];
                        sender.replaceTrack(newVideoTrack);
                    } else {
                        this.localVideo.srcObject = stream;
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

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (message) {
            this.addMessage('self', message);
            this.messageInput.value = '';
            
            // Simular resposta (apenas para demonstração)
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