// Gestion des onglets
document.querySelectorAll('.app-header button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(`${button.id.replace('tab-', '')}-panel`).classList.add('active');
  });
});

// Connexion WebSocket au backend LLM
const socket = new WebSocket('ws://localhost:11434');
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  document.getElementById('chatOutput').innerHTML += `<div class="message ${data.state}">${data.message}</div>`;
};

document.getElementById('chatSend').addEventListener('click', () => {
  const input = document.getElementById('chatInput');
  socket.send(JSON.stringify({ role: 'user', content: input.value }));
  input.value = '';
});