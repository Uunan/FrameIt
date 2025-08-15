// --- START OF FILE webview-preload.js (NİHAİ SÜRÜM + YÜKLEME EKRANI) ---

const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const webview = document.getElementById('content');
    const loadingScreen = document.getElementById('loading-screen');
    const loadingLogo = document.getElementById('loading-logo');
    
    const params = new URLSearchParams(window.location.search);
    const urlToLoad = params.get('url');
    const partition = params.get('partition');
    const logoPath = params.get('logoPath'); // YENİ: Logo yolunu al

    // YENİ: Logoyu yükleme ekranına yerleştir
    if (loadingLogo && logoPath) {
        const decodedLogoPath = decodeURIComponent(logoPath);
        if (decodedLogoPath) {
             // Yerel dosya yolunu doğru formatla ata
            loadingLogo.src = 'file://' + decodedLogoPath;
        }
    }

    if (webview && urlToLoad && partition) {
        webview.setAttribute('partition', partition);
        webview.setAttribute('src', decodeURIComponent(urlToLoad));
        
        webview.addEventListener('ipc-message', (event) => {
            if (event.channel === 'background-color-detected') {
                const color = event.args[0];
                ipcRenderer.send('set-background-color', color);
            }
        });

        const hideLoadingScreen = () => {
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
            // Webview'i görünür yap
            webview.classList.add('loaded');
        };

        // YENİ: Webview yüklenmesi bittiğinde yükleme ekranını gizle
        webview.addEventListener('did-finish-load', hideLoadingScreen);

        // YENİ: Hata durumunda da yükleme ekranını gizle ki kullanıcı takılı kalmasın
        webview.addEventListener('did-fail-load', (e) => {
            if (e.errorCode !== -3) { 
                console.error('Webview yükleme hatası:', e.errorCode, e.errorDescription);
                hideLoadingScreen(); // Hata olsa bile ekranı kaldır
            }
        });

    } else {
        console.error('Webview elementi, yüklenecek URL veya partition adı bulunamadı.');
        if(loadingScreen) loadingScreen.classList.add('hidden'); // Bir sorun varsa yine de ekranı kaldır
    }
});