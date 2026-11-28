// WikiMasters Vente — un clic sur l'icône de l'extension ouvre la page de réglages.
const ext = globalThis.browser || globalThis.chrome;
ext.action.onClicked.addListener(() => ext.runtime.openOptionsPage());

// Firefox demande d'autoriser le site à la main : on ouvre les réglages si ce n'est pas fait
ext.runtime.onInstalled.addListener(async () => {
  const origins = ext.runtime.getManifest().host_permissions || [];
  const ok = await ext.permissions.contains({ origins }).catch(() => true);
  if (!ok) ext.runtime.openOptionsPage();
});
