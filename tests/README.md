# Frontend Test Harness (`venues-front`)

Tests run with Node's built-in test runner (`node --test tests/*.test.js`) via:

```bash
npm test
```

## Conventions & Examples

1. **Domain / Model tests** (pure JS modules, zero DOM required)
   - Example: `tests/mapDocument.test.js`, `tests/mapValidator.test.js`, `tests/venueFormat.test.js`.
   - Use `node:test` (`describe`, `it`) and `node:assert/strict` against shared fixtures in `src/mocks/fixtures/maps/`.

2. **API Client & Contract Mock tests** (MSW in Node)
   - Example: `tests/venueApiClient.test.js`, `tests/mapApiClient.test.js`, `tests/mockApi.test.js`.
   - Start the shared MSW server from `src/mocks/node.js` in `before()` / `after()` and reset handlers in `afterEach()`.

3. **Component / UI rendering tests** (`react-dom/server` + pure view helpers)
   - Example: `tests/role-ui.test.js`, `tests/event-detail.test.js`, `tests/event-edit.test.js`, `tests/mapEditorFlow.test.js`.
   - Render React components with `renderToStaticMarkup` from `react-dom/server` to verify markup, disabled states, error banners and role guards without a browser.
