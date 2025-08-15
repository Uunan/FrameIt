const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const webview = document.getElementById('content');
    
    const params = new URLSearchParams(window.location.search);
    const urlToLoad = params.get('url');

    if (webview && urlToLoad) {
        webview.setAttribute('src', decodeURIComponent(urlToLoad));
        
        // YENİ: guest-preload'dan gelen arkaplan rengi mesajını dinle
        webview.addEventListener('ipc-message', (event) => {
            if (event.channel === 'background-color-detected') {
                const color = event.args[0];
                // Rengi ana sürece (main.js) ilet
                ipcRenderer.send('set-background-color', color);
            }
        });

        webview.addEventListener('did-fail-load', (e) => {
            if (e.errorCode !== -3) { 
                console.error('Webview yükleme hatası:', e.errorCode, e.errorDescription);
            }
        });

    } else {
        console.error('Webview elementi veya yüklenecek URL bulunamadı.');
    }
});