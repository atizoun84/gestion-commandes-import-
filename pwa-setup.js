/**
 * B-one PWA Setup
 * Gestion de l'installation de l'application
 */

let deferredPrompt;
const installBtn = document.getElementById('install-pwa-btn');

// 1. Écouter l'événement d'installation envoyé par le navigateur
window.addEventListener('beforeinstallprompt', (e) => {
    // Empêcher l'affichage automatique de la mini-infobulle native
    e.preventDefault();
    
    // Stocker l'événement pour l'appeler plus tard
    deferredPrompt = e;
    
    // Afficher le bouton flottant dans l'interface
    if (installBtn) {
        installBtn.style.display = 'flex';
        console.log("PWA: Le bouton d'installation est prêt.");
    }
});

// 2. Gérer le clic sur le bouton flottant
if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;

        // Afficher la fenêtre d'installation native
        deferredPrompt.prompt();

        // Attendre que l'utilisateur réponde (Installer ou Annuler)
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA: Réponse de l'utilisateur : ${outcome}`);

        // On réinitialise la variable (l'événement ne peut être utilisé qu'une fois)
        deferredPrompt = null;

        // On masque le bouton puisque l'action est terminée
        installBtn.style.display = 'none';
    });
}

// 3. Masquer le bouton une fois l'application installée avec succès
window.addEventListener('appinstalled', () => {
    console.log('PWA: Application B-one installée !');
    if (installBtn) {
        installBtn.style.display = 'none';
    }
});

// 4. Détection du mode "Standalone" (Si l'utilisateur a déjà lancé l'app installée)
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
    // On s'assure que le bouton reste caché
    if (installBtn) installBtn.style.display = 'none';
}
