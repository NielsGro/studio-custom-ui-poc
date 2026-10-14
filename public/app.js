import { theme } from './theme.js';
import { mountToolbar } from './toolbar.js';
import { createFrame, insertImageVariable, insertTextVariable, trackEditMode } from './actions.js';

const CONTAINER_ID = 'studio-ui-container';

// ---- Feedback helpers ----

let toastTimer;
function toast(message, { error = false } = {}) {
    const el = document.getElementById('poc-toast');
    el.textContent = message;
    el.classList.toggle('poc-toast--error', error);
    el.classList.add('poc-toast--visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('poc-toast--visible'), error ? 5000 : 2500);
}

function showFatalError(message) {
    document.getElementById(CONTAINER_ID).hidden = true;
    document.getElementById('poc-error-message').textContent = message;
    document.getElementById('poc-error').hidden = false;
}

// Runs a toolbar action and shows the message it returns, or its error.
const withFeedback = (action) => async () => {
    try {
        toast(await action());
    } catch (e) {
        console.error('[POC]', e);
        toast(e?.message || 'Something went wrong.', { error: true });
    }
};

// ---- Bootstrapping ----

// All /api calls go to the local server (server.js), which authenticates with the client credentials.
async function api(path, init = {}) {
    const res = await fetch(path, { cache: 'no-store', ...init });
    const isJson = res.headers.get('Content-Type')?.includes('json');
    if (!res.ok) {
        const body = isJson ? await res.json().catch(() => ({})) : {};
        throw new Error(body.error || `${path} failed (${res.status})`);
    }
    return res;
}

const fetchSession = () => api('/api/session').then((res) => res.json());
const fetchToken = () =>
    api('/api/token')
        .then((res) => res.json())
        .then((body) => body.accessToken);

// Looked up once, on first use of "Image Variable".
let grafxMediaPromise;
const getGrafxMedia = (environmentApiBaseUrl) => {
    grafxMediaPromise ??= api('/api/media-connector')
        .then((res) => res.json())
        .then((connector) => ({ ...connector, connectorUrl: `${environmentApiBaseUrl}/connectors/${connector.id}` }))
        .catch((e) => {
            grafxMediaPromise = undefined; // retry next time
            throw e;
        });
    return grafxMediaPromise;
};

async function loadStudioUI(version) {
    const url = `https://studio-cdn.chiligrafx.com/studio-ui/${encodeURIComponent(version)}/es-module/bundle.js`;
    try {
        const module = await import(url);
        return module.default;
    } catch (e) {
        throw new Error(`Could not load Studio UI from ${url} (${e.message}).`);
    }
}

async function start() {
    const session = await fetchSession();
    const StudioUI = await loadStudioUI(session.studioUiVersion);
    window.StudioUI = StudioUI;

    const base = session.environmentApiBaseUrl;
    const { projectId } = session;
    const documentUrl = `/api/project/document?projectId=${encodeURIComponent(projectId)}`;

    let studio = null; // current Studio UI instance
    let nextDocument = null; // document JSON for the next mount; null means "download it"
    let afterNextLoad = null; // runs once when the next mount has loaded the project

    const container = document.getElementById(CONTAINER_ID);
    const toolbar = mountToolbar(container, [
        {
            id: 'create-frame',
            label: 'Create Frame',
            icon: 'frame',
            onClick: withFeedback(createFrame),
        },
        {
            id: 'insert-variable',
            label: 'Insert Variable',
            icon: 'variable',
            items: [
                {
                    id: 'insert-text-variable',
                    label: 'Text Variable',
                    icon: 'text',
                    onClick: withFeedback(insertTextVariable),
                },
                {
                    id: 'insert-image-variable',
                    label: 'Image Variable',
                    icon: 'image',
                    onClick: withFeedback(async () => {
                        const result = await insertImageVariable(await getGrafxMedia(base));
                        await restartStudio(result.frameId);
                        return `${result.message}. You can now upload an image.`;
                    }),
                },
            ],
        },
    ]);

    /**
     * Saves the document and mounts Studio UI again with it, then selects `frameId`.
     *
     * Needed after adding an image variable: Studio UI looks up the media connectors of the document once,
     * right after loading it, and its upload control does nothing for a connector it doesn't know. Every new
     * image variable gets a new connector instance, so Studio UI has to load the document again to see it.
     */
    async function restartStudio(frameId) {
        toolbar.setEnabled(false);
        const { data } = await window.StudioUISDK.document.getCurrentState();
        if (!data) throw new Error('Could not read the current document.');
        await api(documentUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: data });
        const authToken = await fetchToken();

        await new Promise((resolve) => {
            nextDocument = data;
            afterNextLoad = resolve;
            studio.destroy();
            studio = mountStudio(authToken);
        });

        // Studio UI picks its canvas tool shortly after loading; select the frame after that.
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (frameId) {
            await window.StudioUISDK.tool.setSelect().catch(() => {});
            await window.StudioUISDK.frame.select(frameId).catch(() => {});
        }
    }

    const mountStudio = (authToken) =>
        StudioUI.studioUILoaderConfig({
            selector: CONTAINER_ID,
            projectId,
            projectName: session.projectName,
            graFxStudioEnvironmentApiBaseUrl: base,
            projectDownloadUrl: `${base}/projects/${projectId}/document`,
            projectUploadUrl: `${base}/projects/${projectId}`,
            authToken,
            // The server fetches a new client-credentials token when the current one is about to expire.
            refreshTokenAction: fetchToken,
            // At start: downloads the project JSON through the local server. After a restart: the saved JSON.
            onProjectDocumentRequested: async () => {
                if (nextDocument) {
                    const json = nextDocument;
                    nextDocument = null;
                    return json;
                }
                return api(documentUrl).then((res) => res.text());
            },
            uiOptions: {
                uiTheme: 'light',
                theme,
            },
            onProjectLoaded: () => {
                trackEditMode();
                toolbar.setEnabled(true);
                const callback = afterNextLoad;
                afterNextLoad = null;
                callback?.();
            },
            onLoadError: (error) => {
                console.error('[POC] project failed to load', error);
                toast(`Project failed to load: ${error?.message ?? error}`, { error: true });
                const callback = afterNextLoad;
                afterNextLoad = null;
                callback?.();
            },
        });

    studio = mountStudio(session.accessToken);
}

start().catch((e) => {
    console.error('[POC]', e);
    showFatalError(e.message);
});
