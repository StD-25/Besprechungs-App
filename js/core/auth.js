// Anmeldung mit dem Microsoft-Konto (MSAL) für den OneDrive-Abgleich.
// Die Anmelde-Bibliothek wird erst geladen, wenn der Abgleich genutzt wird.

// App-Registrierung „Besprechungsprotokoll“ im Azure-Verzeichnis des Nutzers (kein Geheimnis)
const CLIENT_ID = 'a24cd378-a00f-4af0-9cd8-50056f2ac16e';
// Nur der eigene App-Ordner in OneDrive (Apps/Besprechungsprotokoll)
const SCOPES = ['Files.ReadWrite.AppFolder'];
const LIB_URL = new URL('../../vendor/msal-browser.min.js', import.meta.url).href;

let pcaPromise;
let account = null;

export class LoginRequiredError extends Error {
  constructor() { super('Anmeldung bei Microsoft erforderlich'); this.name = 'LoginRequiredError'; }
}

// Kommt die Seite gerade von der Microsoft-Anmeldung zurück?
export const isRedirectReturn = () => /[#&](code|error)=/.test(location.hash);

function loadLib() {
  if (window.msal) return Promise.resolve(window.msal);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LIB_URL;
    s.onload = () => resolve(window.msal);
    s.onerror = () => reject(new Error('Anmelde-Bibliothek konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
}

// Rücksprung-Adresse = Ordner der aktuellen Seite (Haupt-App oder /kurz/), so wie bei Microsoft eingetragen
const redirectUri = () => new URL('.', location.href.split('#')[0]).href;

export function initAuth() {
  pcaPromise ||= (async () => {
    const msal = await loadLib();
    const pca = new msal.PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: redirectUri(),
        navigateToLoginRequestUrl: false,
      },
      cache: { cacheLocation: 'localStorage' },
    });
    await pca.initialize();
    const result = await pca.handleRedirectPromise();
    account = result?.account || pca.getAllAccounts()[0] || null;
    if (account) pca.setActiveAccount(account);
    return pca;
  })();
  return pcaPromise;
}

export async function getAccount() {
  await initAuth();
  return account;
}

// Zur Microsoft-Anmeldung wechseln; danach kommt die Seite zurück
export async function signIn() {
  const pca = await initAuth();
  await pca.loginRedirect({ scopes: SCOPES, prompt: 'select_account', redirectUri: redirectUri() });
}

// Nur in dieser App abmelden (das Microsoft-Konto im Browser bleibt angemeldet)
export async function signOut() {
  const pca = await initAuth();
  if (account) await pca.clearCache({ account });
  account = null;
}

export async function getToken() {
  const pca = await initAuth();
  if (!account) throw new LoginRequiredError();
  try {
    const res = await pca.acquireTokenSilent({ scopes: SCOPES, account });
    return res.accessToken;
  } catch (err) {
    if (err?.name === 'InteractionRequiredAuthError' || err instanceof window.msal.InteractionRequiredAuthError) {
      throw new LoginRequiredError();
    }
    throw err;
  }
}
