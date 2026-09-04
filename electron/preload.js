const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ElectronAPI', {
  notifierSessionActive: (nomUtilisateur) => ipcRenderer.send('session-active', nomUtilisateur),
  notifierSessionInactive: () => ipcRenderer.send('session-inactive'),
  
  // API Native Impression & Exportation PDF
  genererApercuPDF: (options) => ipcRenderer.invoke('print:generer-preview', options),
  imprimerMateriel: (options) => ipcRenderer.invoke('print:imprimer-materiel', options),
  sauvegarderPDF: (payload) => ipcRenderer.invoke('print:sauvegarder-pdf', payload)
});
