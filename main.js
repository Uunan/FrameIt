// --- START OF FILE main.js (TÜM GÜNCELLEMELER DAHİL) ---

const { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const Jimp = require('jimp');
const ws = require('windows-shortcuts');
const Store = require('electron-store');
const png2icons = require('png2icons');
// YENİ: Otomatik güncelleme için electron-updater'ı dahil et
const { autoUpdater } = require('electron-updater');

const store = new Store({ defaults: { apps: [] } });
let controlPanelWindow;

// =================================================================//
// IPC KANALLARI (RENDERER İLE İLETİŞİM)
// =================================================================//

ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(controlPanelWindow, {
        title: 'Özel İkon Seç',
        properties: ['openFile'],
        filters: [{ name: 'Resim Dosyaları', extensions: ['png', 'jpg', 'jpeg', 'ico', 'icns'] }]
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
});

ipcMain.handle('get-apps', async () => {
    const apps = store.get('apps', []);
    return await Promise.all(apps.map(async (app) => {
        let iconDataUrl = null;
        let iconPathToRead = null;
        if (app.customIconPath && await fs.pathExists(app.customIconPath)) {
            iconPathToRead = app.customIconPath;
        } else if (app.iconPath && await fs.pathExists(app.iconPath)) {
            iconPathToRead = app.iconPath;
        } else if (app.shortcutPath && process.platform === 'darwin' && await fs.pathExists(app.shortcutPath)) {
            iconPathToRead = path.join(app.shortcutPath, 'Contents/Resources/icon.icns');
        }
        try {
            if (iconPathToRead) {
                const image = nativeImage.createFromPath(iconPathToRead);
                if (!image.isEmpty()) iconDataUrl = image.resize({ width: 64, height: 64 }).toDataURL();
            }
        } catch (error) { console.error(`İkon okunamadı (${app.appName}):`, error); }
        return { ...app, iconDataUrl };
    }));
});

ipcMain.handle('delete-app', async (event, appId) => {
    try {
        const apps = store.get('apps');
        const appToDelete = apps.find(app => app.id === appId);
        if (!appToDelete) throw new Error('Silinecek uygulama bulunamadı.');
        if (appToDelete.shortcutPath) await fs.remove(appToDelete.shortcutPath).catch(err => console.error(`Kısayol silinemedi (${appToDelete.shortcutPath}): ${err.message}`));
        if (appToDelete.iconPath) await fs.remove(appToDelete.iconPath).catch(err => console.error(`İkon silinemedi (${appToDelete.iconPath}): ${err.message}`));
        store.set('apps', apps.filter(app => app.id !== appId));
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('create-app', async (event, { appName, appUrl }) => {
    try {
        const paths = await generateShortcut(appName, appUrl, null);
        const newApp = { id: Date.now().toString(), appName, appUrl, ...paths };
        store.set('apps', [...store.get('apps'), newApp]);
        return { success: true, newApp };
    } catch (error) {
        console.error('Uygulama oluşturulamadı:', error);
        dialog.showErrorBox('Oluşturma Hatası', `Bir hata oluştu:\n\n${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('edit-app', async (event, { appId, appName, appUrl, customIconPath }) => {
    try {
        const apps = store.get('apps');
        const appIndex = apps.findIndex(app => app.id === appId);
        if (appIndex === -1) throw new Error("Düzenlenecek uygulama bulunamadı.");
        const oldApp = apps[appIndex];
        if (oldApp.shortcutPath) await fs.remove(oldApp.shortcutPath).catch(err => console.error(`Eski kısayol silinemedi: ${err.message}`));
        if (oldApp.iconPath && oldApp.iconPath !== customIconPath) await fs.remove(oldApp.iconPath).catch(err => console.error(`Eski ikon silinemedi: ${err.message}`));
        
        const finalIconPath = customIconPath !== undefined ? customIconPath : oldApp.customIconPath;
        const newPaths = await generateShortcut(appName, appUrl, finalIconPath);
        const updatedApp = { ...oldApp, appName, appUrl, customIconPath: finalIconPath, ...newPaths };
        apps[appIndex] = updatedApp;
        store.set('apps', apps);
        return { success: true, updatedApp };
    } catch (error) {
        console.error('Uygulama düzenlenemedi:', error);
        dialog.showErrorBox('Düzenleme Hatası', `Bir hata oluştu:\n\n${error.message}`);
        return { success: false, error: error.message };
    }
});

// ANA KISAYOL OLUŞTURMA FONKSİYONU
async function generateShortcut(appName, appUrl, customIconPath = null) {
    const tempDir = path.join(app.getPath('temp'), `frameit-creator-${Date.now()}`);
    await fs.ensureDir(tempDir);
    let normalizedUrl = appUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = 'https://' + normalizedUrl;

    try {
        let imageBuffer;
        if (customIconPath && (await fs.pathExists(customIconPath))) {
            imageBuffer = await fs.readFile(customIconPath);
        } else {
            const { hostname } = new URL(normalizedUrl);
            const finalIconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=256`;
            const response = await fetch(finalIconUrl);
            if (!response.ok) throw new Error(`Google Favicon servisinden ikon alınamadı (HTTP ${response.status}).`);
            imageBuffer = Buffer.from(await response.arrayBuffer());
        }

        const image = await Jimp.read(imageBuffer);
        const cleanPngBuffer = await image.resize(256, 256).getBufferAsync(Jimp.MIME_PNG);

        let paths;
        switch(process.platform) {
            case 'darwin':
                const icnsPath = path.join(tempDir, 'icon.icns');
                const icnsBuffer = png2icons.createICNS(cleanPngBuffer, png2icons.BILINEAR, 0);
                await fs.writeFile(icnsPath, icnsBuffer);
                paths = await createMacShortcut(appName, normalizedUrl, icnsPath);
                break;
            case 'win32':
                const icoPath = path.join(tempDir, 'icon.ico');
                const icoBuffer = png2icons.createICO(cleanPngBuffer, png2icons.BILINEAR, 0, false);
                await fs.writeFile(icoPath, icoBuffer);
                paths = await createWindowsShortcut(appName, normalizedUrl, icoPath);
                break;
            case 'linux':
                const pngPath = path.join(tempDir, 'icon.png');
                await fs.writeFile(pngPath, cleanPngBuffer);
                paths = await createLinuxShortcut(appName, normalizedUrl, pngPath);
                break;
            default: throw new Error('Bu işletim sistemi desteklenmiyor.');
        }
        await fs.remove(tempDir);
        return paths;
    } catch (e) {
        await fs.remove(tempDir).catch(console.error);
        throw e;
    }
}

// PLATFORMA ÖZEL FONKSİYONLAR
async function createMacShortcut(appName, appUrl, icnsPath) {
    const userApplicationsPath = path.join(app.getPath('home'), 'Applications');
    await fs.ensureDir(userApplicationsPath);
    const newAppPath = path.join(userApplicationsPath, `${appName}.app`);
    const mainAppPath = app.getPath('exe');
    const script = `#!/bin/sh\nexec "${mainAppPath}" --app-name="${appName}" --url="${appUrl}"`;
    await fs.ensureDir(path.join(newAppPath, 'Contents/MacOS'));
    await fs.ensureDir(path.join(newAppPath, 'Contents/Resources'));
    const scriptPath = path.join(newAppPath, 'Contents/MacOS', appName);
    await fs.writeFile(scriptPath, script);
    await fs.chmod(scriptPath, '755');
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>${appName}</string><key>CFBundleIconFile</key><string>icon.icns</string><key>CFBundleIdentifier</key><string>com.uunan.frameit.${appName.replace(/[^a-zA-Z0-9]/g, '')}</string></dict></plist>`;
    await fs.writeFile(path.join(newAppPath, 'Contents/Info.plist'), plistContent.trim());
    await fs.copy(icnsPath, path.join(newAppPath, 'Contents/Resources/icon.icns'));
    await new Promise((resolve) => exec(`touch "${newAppPath}"`, () => resolve()));
    return { shortcutPath: newAppPath };
}

async function createWindowsShortcut(appName, appUrl, tempIcoPath) {
    const iconsDir = path.join(app.getPath('userData'), 'icons');
    await fs.ensureDir(iconsDir);
    const permanentIcoPath = path.join(iconsDir, `${Date.now()}-${appName.replace(/[^a-zA-Z0-9]/g, '')}.ico`);
    await fs.copy(tempIcoPath, permanentIcoPath);
    const desktopPath = app.getPath('desktop');
    const shortcutPath = path.join(desktopPath, `${appName}.lnk`);
    
    return new Promise((resolve, reject) => {
        const args = `--app-name="${appName}" --url="${appUrl}"`;
        ws.create(shortcutPath, { 
            target: app.getPath('exe'), 
            args: args, 
            icon: permanentIcoPath,
            runStyle: ws.NORMAL, 
            description: appName, 
        }, (err) => { 
            if (err) {
                reject(new Error(`Windows kısayolu oluşturulamadı: ${err}`));
            } else {
                resolve({ shortcutPath, iconPath: permanentIcoPath }); 
            }
        });
    });
}

async function createLinuxShortcut(appName, appUrl, pngPath) {
    const appIdentifier = appName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const userApplicationsPath = path.join(app.getPath('home'), '.local/share/applications');
    const iconDir = path.join(app.getPath('home'), '.local/share/icons/hicolor/256x256/apps');
    await fs.ensureDir(iconDir);
    const finalPngPath = path.join(iconDir, `${appIdentifier}.png`);
    await fs.copy(pngPath, finalPngPath);
    const shortcutPath = path.join(userApplicationsPath, `${appIdentifier}.desktop`);
    const desktopFileContent = `[Desktop Entry]\nVersion=1.0\nType=Application\nName=${appName}\nComment=${appName}\nExec="${app.getPath('exe')}" --app-name="${appName}" --url="${appUrl}"\nIcon=${finalPngPath}\nTerminal=false\nCategories=Network;WebBrowser;`;
    await fs.ensureDir(userApplicationsPath);
    await fs.writeFile(shortcutPath, desktopFileContent.trim());
    await fs.chmod(shortcutPath, '755');
    return { shortcutPath, iconPath: finalPngPath };
}

// PENCERE YÖNETİMİ VE YAŞAM DÖNGÜSÜ
function createWebviewWindow(urlToLoad, appName) {
    const webviewWindow = new BrowserWindow({
        width: 1280, height: 800, minWidth: 800, minHeight: 600,
        title: appName,
        webPreferences: { webviewTag: true, preload: path.join(__dirname, 'webview-preload.js'), nodeIntegration: false, contextIsolation: true, },
    });
    
    webviewWindow.on('page-title-updated', (event) => {
        event.preventDefault();
    });
    
    if (process.platform !== 'darwin') {
        webviewWindow.removeMenu();
    }
    
    webviewWindow.webContents.on('did-finish-load', () => {
        webviewWindow.webContents.send('set-url', urlToLoad);
    });
    webviewWindow.loadFile('webview.html');
}

function createControlPanel() {
    controlPanelWindow = new BrowserWindow({
        width: 800, height: 600, minWidth: 600, minHeight: 400,
        title: "FrameIt Yöneticisi",
        backgroundColor: '#1c1c1e',
        webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, },
    });
    
    if (process.platform !== 'darwin') {
        controlPanelWindow.removeMenu();
    }
    
    controlPanelWindow.loadFile('index.html');
    controlPanelWindow.on('closed', () => { controlPanelWindow = null; });
}

const getArgValue = (argName) => {
    const prefix = `--${argName}=`;
    const arg = process.argv.find(arg => arg.startsWith(prefix));
    if (!arg) return null;
    let value = arg.substring(prefix.length);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
    }
    return value;
};

// UYGULAMA YAŞAM DÖNGÜSÜ
app.whenReady().then(() => {
    if (process.platform === 'darwin') {
        const template = [{
            label: app.getName(),
            submenu: [{ role: 'quit' }]
        }];
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    const urlToLoad = getArgValue('url');
    const appNameToLoad = getArgValue('app-name');

    if (urlToLoad && appNameToLoad) {
        createWebviewWindow(urlToLoad, appNameToLoad);
    } else {
        createControlPanel();
        // YENİ: Sadece ana kontrol paneli açıldığında güncellemeleri kontrol et.
        // Bu, her bir web uygulamasının güncelleme kontrolü yapmasını engeller.
        autoUpdater.checkForUpdatesAndNotify();
    }
});

// YENİ: OTOMATİK GÜNCELLEME OLAYLARI
autoUpdater.on('update-available', () => {
  console.log('Yeni bir güncelleme mevcut.');
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Güncelleme indirildi, kuruluma hazır.');
    // Kullanıcıya güncellemenin hazır olduğunu bildiren bir diyalog kutusu göster.
    const dialogOpts = {
        type: 'info',
        buttons: ['Yeniden Başlat', 'Daha Sonra'],
        title: 'Uygulama Güncellemesi',
        message: process.platform === 'win32' ? info.releaseNotes : info.releaseName,
        detail: 'Yeni bir sürüm indirildi. Değişikliklerin etkili olması için uygulamayı şimdi yeniden başlatın.'
    };

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
        // Eğer kullanıcı "Yeniden Başlat" butonuna tıklarsa (index 0)
        if (returnValue.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

autoUpdater.on('error', (err) => {
  console.error('Güncelleme hatası:', err ? (err.stack || err).toString() : 'Bilinmeyen Hata');
});


app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        const urlToLoad = getArgValue('url');
        if (!urlToLoad) {
            createControlPanel();
        }
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});