const { ipcRenderer } = require('electron');

// Sayfa tamamen yüklendiğinde çalış
window.addEventListener('DOMContentLoaded', () => {
    try {
        // body elementinin hesaplanmış arkaplan rengini al
        const color = window.getComputedStyle(document.body).backgroundColor;
        
        // Rengi ana pencereye (host) gönder
        if (color) {
            ipcRenderer.sendToHost('background-color-detected', color);
        }
    } catch (error) {
        console.error('Arkaplan rengi alınamadı:', error);
    }
});