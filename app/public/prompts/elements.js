/**
 * Prompt Library Element Registry
 * Why: Cache DOM lookups so other modules can operate without repeated queries.
 * What: Captures references to key form fields, list containers, and status surfaces.
 * How: Runs once at load time and stores the references on window.promptEls.
 */
(function capturePromptElements(global) {
  if (!global || global.promptEls) {
    return;
  }

  const documentRef = global.document;
  if (!documentRef) {
    return;
  }

  global.promptEls = {
    list: documentRef.getElementById('prompt-list'),
    searchInput: documentRef.getElementById('prompt-search'),
    refreshButton: documentRef.getElementById('prompt-refresh'),
    newButton: documentRef.getElementById('prompt-new'),
    deleteButton: documentRef.getElementById('prompt-delete'),
    form: documentRef.getElementById('prompt-form'),
    status: documentRef.getElementById('prompt-status'),
    githubPullButton: documentRef.getElementById('prompt-github-pull'),
    githubPushButton: documentRef.getElementById('prompt-github-push'),
    githubSyncButton: documentRef.getElementById('prompt-github-sync'),
    githubStatus: documentRef.getElementById('prompt-github-status'),
    idInput: documentRef.getElementById('prompt-id'),
    titleInput: documentRef.getElementById('prompt-title'),
    descriptionInput: documentRef.getElementById('prompt-description'),
    tagsInput: documentRef.getElementById('prompt-tags'),
    bodyInput: documentRef.getElementById('prompt-body'),
    metadataInput: documentRef.getElementById('prompt-metadata')
  };
})(typeof window !== 'undefined' ? window : undefined);
