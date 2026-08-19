const { app, BrowserWindow, Tray, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

const PORT = Number(process.env.PORT || 4000);
const APP_TITLE = 'SchoolPAY \u2014 Gestion de Caisse Scolaire';

let fenetre = null;
let tray = null;
let serveur_backend = null;
let port_utilise = PORT;
let session_utilisateur = null;

// Gestion de session caissier via IPC pour la déconnexion automatique à la fermeture
ipcMain.on('session-active', (event, nom_utilisateur) => {
  console.log(`Session active signalee via IPC pour : ${nom_utilisateur}`);
  session_utilisateur = nom_utilisateur;
});

ipcMain.on('session-inactive', () => {
  console.log('Session inactive signalee via IPC');
  session_utilisateur = null;
});

function enregistrer_deconnexion_automatique() {
  if (!session_utilisateur) return;
  console.log(`Fermeture detectee. Enregistrement automatique de la deconnexion pour : ${session_utilisateur}`);
  try {
    const root = racine();
    const app_db = path.join(root, 'BACKEND', 'src', 'base_de_donnees', 'base_de_donnees.js');
    const app_logs = path.join(root, 'BACKEND', 'src', 'controleurs', 'logs.controleur.js');
    
    const { creer_base_de_donnees } = require(app_db);
    const { enregistrer_log_par_nom } = require(app_logs);
    
    const base_de_donnees = creer_base_de_donnees();
    // Enregistre l'action de déconnexion comme s'il avait cliqué (action = 'deconnexion', reference_action = '-')
    enregistrer_log_par_nom(base_de_donnees, session_utilisateur, 'deconnexion', '-');
    console.log('Deconnexion de fermeture enregistree avec succes.');
    session_utilisateur = null;
  } catch (erreur) {
    console.error('Erreur lors de l\'enregistrement de la deconnexion automatique :', erreur);
  }
}

function racine() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
}

function configurer_journalisation() {
  const log_path = path.join(app.getPath('userData'), 'schoolpay.log');
  const stream = fs.createWriteStream(log_path, { flags: 'a' });
  const ts = () => new Date().toISOString();
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...a) => { stream.write(`[${ts()}] INFO: ${a.join(' ')}\n`); origLog.apply(console, a); };
  console.warn = (...a) => { stream.write(`[${ts()}] WARN: ${a.join(' ')}\n`); origWarn.apply(console, a); };
  console.error = (...a) => { stream.write(`[${ts()}] ERROR: ${a.join(' ')}\n`); origError.apply(console, a); };
  process.on('uncaughtException', (err) => {
    stream.write(`[${ts()}] UNCAUGHT: ${err.stack || err}\n`);
    app.quit();
  });
}

function attendre_port(port, timeout_ms = 15000) {
  return new Promise((resolve) => {
    const debut = Date.now();
    const tester = () => {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => {
        socket.destroy();
        resolve(Date.now() - debut >= timeout_ms ? false : setTimeout(tester, 150));
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve(Date.now() - debut >= timeout_ms ? false : setTimeout(tester, 150));
      });
      socket.connect(port, '127.0.0.1');
    };
    tester();
  });
}

function creer_fenetre() {
  const root = racine();
  const icon_path = path.join(root, 'FRONTEND', 'img', 'icone_desktop.ico');

  fenetre = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    center: true,
    title: APP_TITLE,
    icon: icon_path,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  fenetre.once('ready-to-show', () => {
    fenetre.show();
    fenetre.focus();
  });

  fenetre.on('close', () => {
    enregistrer_deconnexion_automatique();
    arreter_backend();
    fenetre = null;
  });

  fenetre.loadURL(`http://127.0.0.1:${port_utilise}`);
}

function creer_tray() {
  const icon_path = path.join(racine(), 'FRONTEND', 'img', 'icone_desktop.ico');
  try {
    const icon = nativeImage.createFromPath(icon_path);
    tray = new Tray(icon);
    tray.setToolTip('SchoolPAY');
    tray.on('click', () => {
      if (fenetre) {
        if (fenetre.isMinimized()) fenetre.restore();
        fenetre.show();
        fenetre.focus();
      }
    });
  } catch (e) {
    console.warn('Tray icon non disponible:', e.message);
  }
}

function demarrer_backend() {
  const root = racine();
  const app_js = path.join(root, 'BACKEND', 'app.js');
  console.log('racine_app:', root);
  console.log('Chargement backend:', app_js);
  const { demarrer_serveur } = require(app_js);
  return demarrer_serveur(PORT).then((resultat) => {
    serveur_backend = resultat.serveur;
    port_utilise = resultat.port;
  });
}

function arreter_backend() {
  if (!serveur_backend) return;
  const s = serveur_backend;
  serveur_backend = null;
  const timeout = setTimeout(() => {
    console.warn('Arrêt forcé du serveur');
    try { s.closeAllConnections(); } catch (_) {}
    process.exit(0);
  }, 3000);
  timeout.unref();
  s.close(() => {
    clearTimeout(timeout);
    process.exit(0);
  });
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    configurer_journalisation();
    const userDataDir = app.getPath('userData');
    const dbDir = path.join(userDataDir, 'donnees');
    process.env.SCHOOLPAY_DB_DIR = dbDir;

    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const dbCible = path.join(dbDir, 'schoolpay.sqlite');
    const dbSource = path.join(racine(), 'BACKEND', 'donnees', 'schoolpay.sqlite');
    if (!fs.existsSync(dbCible) && fs.existsSync(dbSource)) {
      fs.copyFileSync(dbSource, dbCible);
      console.log('Base de donnees copiee depuis:', dbSource);
    }

    const asar_modules = path.join(app.getAppPath(), 'node_modules');
    if (fs.existsSync(asar_modules)) {
      process.env.NODE_PATH = asar_modules;
      require('module').Module._initPaths();
    }
  }

  console.log('SchoolPAY demarrage...');
  console.log('Packaged:', app.isPackaged);

  try {
    await demarrer_backend();
    const pret = await attendre_port(port_utilise);
    if (!pret) console.error('Le serveur backend n\'a pas demarr\u00e9 \u00e0 temps.');
    creer_fenetre();
    creer_tray();
  } catch (erreur) {
    console.error('Erreur au demarrage:', erreur);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    enregistrer_deconnexion_automatique();
    arreter_backend();
  }
});

app.on('activate', () => {
  if (fenetre === null) creer_fenetre();
});

app.on('before-quit', () => {
  enregistrer_deconnexion_automatique();
  arreter_backend();
});
