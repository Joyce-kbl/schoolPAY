const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ElectronAPI', {
  notifierSessionActive: (nomUtilisateur) => ipcRenderer.send('session-active', nomUtilisateur),
  notifierSessionInactive: () => ipcRenderer.send('session-inactive')
});
