const https = require('https');

function startKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL;

  if (!url) {
    console.log('[KeepAlive] RENDER_EXTERNAL_URL no definida. Servicio no iniciado.');
    return;
  }

  setInterval(() => {
    https
      .get(`${url}/health`, (res) => {
        console.log(`[KeepAlive] Ping OK. Status: ${res.statusCode}`);
      })
      .on('error', (err) => {
        console.error('[KeepAlive] Error:', err.message);
      });
  }, 5 * 60 * 1000);

  console.log('[KeepAlive] Servicio iniciado. Ping cada 5 minutos.');
}

module.exports = startKeepAlive;