// --- START OF FILE preload.js ---

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getApps: () => ipcRenderer.invoke('get-apps'),
    createApp: (data) => ipcRenderer.invoke('create-app', data),
    editApp: (data) => ipcRenderer.invoke('edit-app', data),
    deleteApp: (appId) => ipcRenderer.invoke('delete-app', appId),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    // Güncelleme loglarını dinlemek için yeni kanal
    onUpdateLog: (callback) => ipcRenderer.on('update-log', callback)
});