# Studio Custom UI – Proof of Concept

Embeds CHILI GraFx **Studio UI** in a web page and customises it:

- **Custom toolbar buttons** in Studio's top toolbar:
  - **Create Frame**: creates a new text frame on the selected layout and selects it.
  - **Insert Variable** (dropdown, opens on hover):
    - **Text Variable**: creates a short text variable and inserts it into the selected text frame.
    - **Image Variable**: creates a "user upload" image variable on GraFx Media and links it to the selected image frame (or to a new image frame). The end user can then upload their own image.
- **Themes**: a white & yellow default theme and a DHL theme (DHL yellow and red), switchable in `config.json`, with an optional logo in the toolbar.
- **Automatic authentication**: the local server gets a token with the OAuth client-credentials flow.
- **One config file** for the environment, the client credentials and the project.

No build step and no npm dependencies. You only need Node.js 18 or newer.

## Getting started

1. Copy the example config and fill in your values:

   ```bash
   cp config.example.json config.json
   ```

2. Start the app:

   ```bash
   npm start
   ```

3. Open <http://localhost:3000>.

## Configuration (`config.json`)

| Key                     | Required | Description                                                                                                       |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `environment`           | yes      | GraFx environment name, e.g. `cp-abc-123`.                                                                        |
| `clientId`              | yes      | Client ID of the GraFx integration.                                                                               |
| `clientSecret`          | yes      | Client secret of the GraFx integration. Stays on the local server; never sent to the browser.                     |
| `projectId`             | one of   | ID of the project to open. It must be accessible for the integration (see notes below).                           |
| `templateId`            | one of   | Used when `projectId` is empty: on first start, the POC creates a project from this template and saves its ID as `projectId`. |
| `projectName`           | no       | Display name, also used as the name of a project created from `templateId`. Default: `Studio Custom UI POC`.      |
| `studioUiVersion`       | no       | Studio UI version on the CDN, e.g. `latest` or a pinned version. Default: `latest`.                               |
| `theme`                 | no       | `default` (white & yellow) or `dhl`. Themes are defined in `public/theme.js`.                                     |
| `logoUrl`               | no       | Logo shown at the left of the toolbar, e.g. `/brand/dhl-logo.svg` (a file in `public/brand/`) or a full URL. Hidden when empty or missing. |
| `pageTitle`             | no       | Browser tab title, e.g. `DHL – Studio POC`.                                                                       |
| `tokenUrl`              | no       | OAuth token URL. Default: `https://integration-login.chiligrafx.com/oauth/token`.                                 |
| `audience`              | no       | OAuth audience. Default: `https://chiligrafx.com`.                                                                |
| `environmentApiBaseUrl` | no       | Overrides the derived API URL `https://<environment>.chili-publish.online/grafx/api/v1/environment/<environment>`. |
| `port`                  | no       | Local port. Default: `3000`. The `PORT` env variable takes precedence.                                            |

The server reads `config.json` on every request, so changes apply without a restart.

> `config.json` is git-ignored because it contains the client secret. Share `config.example.json` instead.

## How it works

```
public/
  index.html   page with the container div Studio UI renders into
  app.js       loads Studio UI from the CDN and starts it with the session, theme and toolbar
  theme.js     themes: Studio UI colours (`uiOptions.theme`) and CSS variables for the POC's own elements
  brand/       logo files (git-ignored, except its README)
  toolbar.js   injects the custom buttons and the dropdown into Studio UI's navbar
  actions.js   button logic, using the Studio SDK
  styles.css   styling for the custom buttons, dropdown, toast and error screen
server.js      zero-dependency server: static files, authentication and GraFx API calls
```

### Server endpoints

| Endpoint                     | Purpose                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /api/session`           | Resolves the project (creating it from `templateId` if needed) and returns an access token.    |
| `GET /api/token`             | Returns a valid access token; Studio UI calls it through `refreshTokenAction`.                 |
| `GET /api/project/document`  | Downloads the project JSON. The page passes it to the editor at start (`onProjectDocumentRequested`). |
| `PUT /api/project/document`  | Saves the project JSON; used before Studio UI is restarted after adding an image variable.     |
| `GET /api/media-connector`   | Finds the built-in GraFx Media connector, used by Image Variable.                              |

Tokens are cached on the server and renewed 5 minutes before they expire.

### Studio UI customisation

- **Studio UI** is loaded as an ES module from `https://studio-cdn.chiligrafx.com/studio-ui/<version>/es-module/bundle.js` and started with `StudioUI.studioUILoaderConfig(...)`.
- **Theme**: each theme in `public/theme.js` has Studio UI colours, passed as `uiOptions.theme` with `uiTheme: 'light'`, and CSS variables for the top bar, custom buttons, dropdown and toast. Studio UI's top bar uses its panel colour, so the POC overrides its background with CSS to get e.g. the DHL-yellow bar. To add a theme, add an entry to `themes` and set its name in `config.json`.
- **DHL theme**: DHL yellow `#FFCC00` top bar, DHL red `#D40511` for primary and custom buttons, neutral grey canvas. DHL's typeface ("Delivery") is licensed; the page uses it when it's installed and falls back to Arial/Helvetica.
- **Logo**: brand logos are trademarks, so none is included. Put the official file in `public/brand/` and set `logoUrl`. That folder is git-ignored.
- **Toolbar buttons**: Studio UI has no public API for adding toolbar items yet. The POC prepends an extra `<li>` to Studio's navbar (`nav[data-id="sui-navbar"] > ul`), and a `MutationObserver` re-adds it whenever Studio re-renders the navbar. The buttons stay disabled until `onProjectLoaded` fires. The Insert Variable dropdown opens on hover, on keyboard focus and on click (for touch screens).
- **Actions** use the SDK instance that Studio UI exposes as `window.StudioUISDK`:
  - Create Frame: `frame.create('text', …)` inside `undoManager.record`, `frame.rename`, `experiment.setText`. It then sets the frame constraints (`selectable`, `textEditingAllowed`, movement, resize) so end users can interact with the frame, and finally `tool.setSelect` and `frame.select`.
  - Text Variable: `variable.create('', 'shortText')`, `rename`, `setLabel`, `setIsVisible`, `setValue`. If the user is already editing text, the variable goes in at the caret (`experiment.insertTextVariable`). Otherwise the POC enters text edit mode, places the caret at the end of the text, inserts the variable and leaves edit mode again.
  - Image Variable: `variable.create('', 'image')`, then `setImageVariableConnector` with the GraFx Media connector, `setAllowImageUpload(true)` and `setAllowImageQuery(false)`. Studio UI then shows an "Upload an image" control for it. Finally `experiment.insertImageVariableToFrame` links it to the selected image frame. With no image frame selected, a new one is created first.
  - **Studio UI restart after Image Variable**: Studio UI builds its list of media connectors once, right after loading the document, and the upload control does nothing for a connector that isn't in that list. Each new image variable gets a new connector instance, so after adding one the POC saves the document (`PUT /api/project/document`), restarts Studio UI with it (`destroy()` and `studioUILoaderConfig` again) and re-selects the frame. This takes a second or two and clears the undo history.

## Notes & limitations

- **Projects belong to whoever created them.** A project created by a user in GraFx is not accessible with the integration's client credentials; the API returns 404 and the page explains this. Use a project created by the integration, or set `templateId` so the POC creates one.
- **Your changes are saved to the real project.** Studio UI autosaves, so frames and variables you create are persisted. Images uploaded by the end user go to GraFx Media in the environment. Use a test project.
- **Text Variable needs a selected text frame.** In Studio UI, end users can only select frames whose constraints allow selection. Frames made by the POC are always selectable. For existing frames, it depends on the template's constraints.
- **Experimental SDK calls**: inserting variables and setting text use `sdk.experiment.*`, which the SDK marks as subject to change. Pin `studioUiVersion` if you need stability.
- **Navbar injection depends on Studio UI's DOM** (`data-id="sui-navbar"`). If a future Studio UI version changes that markup, update `NAVBAR_LIST_SELECTOR` in `public/toolbar.js`.
- **The access token reaches the browser**, because the Studio editor needs it. The client secret does not. A production integration should issue short-lived tokens with limited scope.
- The server only listens on `127.0.0.1`. To share the POC, share the folder or repository without `config.json`.
