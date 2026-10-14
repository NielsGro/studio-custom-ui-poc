// Custom actions executed through the Studio SDK instance that Studio UI exposes as `window.StudioUISDK`.
// Every SDK call resolves to `{ success, parsedData, ... }` and rejects on engine errors.

const sdk = () => {
    if (!window.StudioUISDK) throw new Error('Studio is not ready yet.');
    return window.StudioUISDK;
};

// Tracks whether the engine is in text edit mode, so a variable can be inserted at the caret.
let inTextEditMode = false;
export function trackEditMode() {
    sdk().config.events.onEngineEditModeChanged.registerCallback((editMode) => {
        inTextEditMode = editMode?.mode === 'textEdit';
    });
}

function nextFreeIndex(items, prefix) {
    const names = new Set((items ?? []).map((item) => item.name));
    let i = 1;
    while (names.has(`${prefix} ${i}`)) i += 1;
    return i;
}

// Constraint setters differ per engine version; a missing one should not break the action.
async function tryCall(fn) {
    try {
        await fn();
    } catch (e) {
        console.warn('[POC] optional SDK call failed', e);
    }
}

/**
 * Adds a frame centered on the selected layout (cascaded a little per new frame, so frames don't stack
 * exactly on top of each other), makes it usable for the end user and selects it.
 */
async function addFrame(type, namePrefix, { widthRatio, heightRatio }) {
    const studio = sdk();

    const { parsedData: layout } = await studio.layout.getSelected();
    const layoutWidth = layout?.width?.value ?? 500;
    const layoutHeight = layout?.height?.value ?? 500;
    const { parsedData: frames } = await studio.frame.getAll();
    const index = nextFreeIndex(frames, namePrefix);
    const name = `${namePrefix} ${index}`;

    const width = Math.round(layoutWidth * widthRatio);
    const height = Math.round(layoutHeight * heightRatio);
    const offset = ((index - 1) % 6) * 0.04;
    const x = Math.round((layoutWidth - width) / 2 + layoutWidth * offset);
    const y = Math.round((layoutHeight - height) / 2 + layoutHeight * offset);

    let frameId;
    await studio.undoManager.record(`pocCreate_${type}Frame`, async (s) => {
        ({ parsedData: frameId } = await s.frame.create(type, x, y, width, height));
        await s.frame.rename(frameId, name);
    });
    if (!frameId) throw new Error('The engine did not return a frame id.');

    // Studio UI only lets end users interact with frames whose constraints allow it.
    const constraints = studio.frame.constraints;
    await tryCall(() => constraints.setSelectable(frameId, true));
    await tryCall(() => constraints.setHorizontalMovement(frameId, true));
    await tryCall(() => constraints.setVerticalMovement(frameId, true));
    await tryCall(() => constraints.setResize(frameId, true));
    if (type === 'text') await tryCall(() => constraints.setTextEditingAllowed(frameId, true));

    return { id: frameId, name };
}

async function selectFrame(frameId) {
    const studio = sdk();
    await tryCall(() => studio.tool.setSelect());
    await tryCall(() => studio.frame.select(frameId));
}

async function getSelectedFrame() {
    const { parsedData: selected } = await sdk().frame.getSelected();
    return selected?.[0] ?? null;
}

// Creates a visible variable with a unique "<prefix> <n>" name and label.
async function addVariable(type, namePrefix) {
    const studio = sdk();
    const { parsedData: variables } = await studio.variable.getAll();
    const name = `${namePrefix} ${nextFreeIndex(variables, namePrefix)}`;

    const { parsedData: id } = await studio.variable.create('', type);
    if (!id) throw new Error('The engine did not return a variable id.');
    await studio.variable.rename(id, name);
    await tryCall(() => studio.variable.setLabel(id, name));
    await tryCall(() => studio.variable.setIsVisible(id, true));
    return { id, name };
}

/**
 * Create Frame: adds a text frame and selects it, so "Insert Variable" can be used right away.
 */
export async function createFrame() {
    const frame = await addFrame('text', 'POC Frame', { widthRatio: 0.5, heightRatio: 0.15 });
    // Placeholder text (fails on documents without any fonts, which is fine: the frame still exists).
    await tryCall(() => sdk().experiment.setText(frame.id, 'New text frame'));
    await selectFrame(frame.id);
    return `Created "${frame.name}"`;
}

/**
 * Insert Variable › Text Variable: creates a short text variable and inserts it into the selected text frame.
 * In text edit mode it is inserted at the caret, otherwise it is appended to the end of the text.
 */
export async function insertTextVariable() {
    const studio = sdk();

    const frame = await getSelectedFrame();
    if (!frame) throw new Error('Select a text frame first.');
    if (frame.type !== 'text') {
        const article = /^[aeiou]/i.test(frame.type) ? 'an' : 'a';
        throw new Error(`The selected frame is ${article} ${frame.type} frame. Select a text frame.`);
    }

    const variable = await addVariable('shortText', 'Text Variable');
    await tryCall(() => studio.variable.setValue(variable.id, variable.name));

    if (inTextEditMode) {
        await studio.experiment.insertTextVariable(variable.id);
        return `Inserted "${variable.name}"`;
    }

    // Not editing yet: enter text edit mode, put the caret at the end, insert, and leave edit mode.
    await studio.experiment.enterTextEditMode(frame.id);
    try {
        await tryCall(async () => {
            const { parsedData: text } = await studio.experiment.getText(frame.id, 'text');
            const end = Math.max((text ?? '').replace(/\n$/, '').length, 0);
            await studio.experiment.selectText(frame.id, end, 0);
        });
        await studio.experiment.insertTextVariable(variable.id);
    } finally {
        await tryCall(() => studio.experiment.exitTextEditMode());
    }
    return `Inserted "${variable.name}"`;
}

/**
 * Insert Variable › Image Variable: creates an image variable on the GraFx Media connector that only allows
 * the end user to upload an image (no browsing), and links it to the selected image frame. When no image frame
 * is selected, a new image frame is created for it.
 * Studio UI must load the document again before its upload control works for the new variable (see app.js).
 *
 * @param {{ connectorUrl: string }} grafxMedia environment API URL of the GraFx Media connector
 */
export async function insertImageVariable(grafxMedia) {
    const studio = sdk();

    const selected = await getSelectedFrame();
    const frame =
        selected?.type === 'image'
            ? { id: selected.id, name: selected.name, created: false }
            : { ...(await addFrame('image', 'POC Image Frame', { widthRatio: 0.35, heightRatio: 0.35 })), created: true };

    const variable = await addVariable('image', 'Image Variable');
    await studio.variable.setImageVariableConnector(variable.id, { source: 'grafx', url: grafxMedia.connectorUrl });
    // "User upload": Studio UI then shows an upload control for this variable instead of a media browser.
    await studio.variable.setAllowImageUpload(variable.id, true);
    await studio.variable.setAllowImageQuery(variable.id, false);

    await studio.experiment.insertImageVariableToFrame(frame.id, variable.id);
    await selectFrame(frame.id);

    return {
        frameId: frame.id,
        message: frame.created
            ? `Created "${frame.name}" with "${variable.name}"`
            : `Linked "${variable.name}" to "${frame.name}"`,
    };
}
