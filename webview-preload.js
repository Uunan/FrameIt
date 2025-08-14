const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const webview = document.getElementById('content');
    
    // Main sürecinden gelen 'set-url' olayını dinle
    ipcRenderer.on('set-url', (event, url) => {
        if (webview) {
            webview.setAttribute('src', url); // Webview'in URL'sini ayarla
            
            // Webview'in sayfa başlığı güncellendiğinde ana pencerenin başlığını da güncelle
            webview.addEventListener('page-title-updated', (e) => {
                document.title = e.title;
            });

            // Webview bir hata yüklerse (örn: sayfa bulunamadı)
            webview.addEventListener('did-fail-load', (e) => {
                if (e.errorCode !== -3) { // -3 usually means cancelled, ignore
                    console.error('Webview yükleme hatası:', e);
                    // Kullanıcıya bir hata mesajı gösterebilirsiniz
                    // webview.loadURL(`data:text/html,<h1>Hata</h1><p>Sayfa yüklenemedi: ${e.errorDescription}</p>`);
                }
            });
        }
    });
});