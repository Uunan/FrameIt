const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getApps: () => ipcRenderer.invoke('get-apps'),
    // Artık özel ikon yolu almıyor
    createApp: (data) => ipcRenderer.invoke('create-app', data), 
    editApp: (data) => ipcRenderer.invoke('edit-app', data),
    deleteApp: (appId) => ipcRenderer.invoke('delete-app', appId),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
});