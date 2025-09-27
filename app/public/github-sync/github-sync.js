// github-sync.js: UI logic for GitHub Research Sync dashboard
async function callGithubSync(action, repo, files = []) {
  const res = await fetch('/api/research/github-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, repo, files })
  });
  return res.json();
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('github-sync-form');
  const resultBox = document.getElementById('github-sync-result');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const action = form.action.value;
    const repo = form.repo.value;
    const files = form.files.value.split(',').map(f => f.trim()).filter(Boolean);
    resultBox.textContent = 'Working...';
    const result = await callGithubSync(action, repo, files);
    resultBox.textContent = result.success ? '✅ ' + result.message : '❌ ' + result.message + (result.details ? ('\n' + result.details) : '');
  };
});
