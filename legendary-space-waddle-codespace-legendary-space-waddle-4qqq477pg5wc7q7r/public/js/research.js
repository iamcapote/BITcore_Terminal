document.addEventListener('DOMContentLoaded', () => {
    const API_ENDPOINT = '/api/docs'; // Placeholder for the actual API endpoint

    const allFilesContainer = document.getElementById('research-tree-all');
    const byCategoryContainer = document.getElementById('research-tree-category');
    const byTagsContainer = document.getElementById('research-tree-tags');
    const viewer = document.getElementById('document-viewer');
    const titleElement = document.getElementById('markdown-title');
    const contentElement = document.getElementById('markdown-content');
    const categoriesContainer = document.getElementById('document-categories');
    const tagsContainer = document.getElementById('document-tags');
    const searchInput = document.getElementById('search-input');
    const statDocs = document.getElementById('stat-docs');
    const statCategories = document.getElementById('stat-categories');
    const statTags = document.getElementById('stat-tags');

    let allDocuments = []; // To store fetched document data

    // --- Data Fetching ---
    async function fetchData() {
        try {
            // TODO: Replace with actual API call
            // const response = await fetch(API_ENDPOINT);
            // if (!response.ok) {
            //     throw new Error(`HTTP error! status: ${response.status}`);
            // }
            // allDocuments = await response.json();

            // --- MOCK DATA --- Remove this when API is ready
            allDocuments = [
                { filename: 'test.md', title: 'Quantum Neural Networks', categories: ['physics', 'ai'], tags: ['quantum', 'neural'] },
                { filename: 'test copy.md', title: 'Fractal Mathematics in Higher Dimensions', categories: ['ai', 'mathematics'], tags: ['fractal', 'dimensions'] },
                { filename: 'test copy 2.md', title: 'Toroidal Field Theory and Consciousness', categories: ['physics', 'consciousness'], tags: ['toroidal', 'consciousness'] }
            ];
            // --- END MOCK DATA ---

            renderAllViews();
            updateStats();

        } catch (error) {
            console.error("Failed to fetch research data:", error);
            allFilesContainer.innerHTML = 'Error loading files.';
            byCategoryContainer.innerHTML = 'Error loading categories.';
            byTagsContainer.innerHTML = 'Error loading tags.';
        }
    }

    // --- Rendering Logic ---

    function renderAllViews() {
        renderFileTree(allFilesContainer, groupAllFiles(allDocuments));
        renderCategorizedTree(byCategoryContainer, groupByCategory(allDocuments));
        renderCategorizedTree(byTagsContainer, groupByTag(allDocuments));
        setupSearch(); // Setup search after initial render
    }

    function createTreeHTML(nodes) {
        // Add 'tree-root' class for specific styling
        let html = '<ul class="tree-root">';
        for (const node of nodes) {
            html += '<li>';
            if (node.type === 'folder') {
                // Use open attribute for default state if needed, add folder icon
                // Add folder icon before the toggle button and label
                html += `<details open>`; // Keep folders open by default for better initial view
                html += `<summary><span class="toggle-btn">▼</span><span class="folder-icon">📁</span><span class="folder-label">${node.name}</span></summary>`;
                // Add class to children container for indentation styling
                html += `<div class="folder-content">${createTreeHTML(node.children)}</div>`;
                html += `</details>`;
            } else {
                // Add file icon before the link
                html += `<div class="file">
                           <span class="file-icon">📄</span><a href="#" data-filename="${node.filename}" data-title="${node.title}">${node.title}</a>
                         </div>`;
            }
            html += '</li>';
        }
        html += '</ul>';
        return html;
    }

    function renderFileTree(container, fileStructure) {
         if (!container) return;
         container.innerHTML = createTreeHTML(fileStructure);
         addFileClickListeners(container);
         addToggleListeners(container);
    }

     function renderCategorizedTree(container, categoryStructure) {
        if (!container) return;
        const nodes = Object.entries(categoryStructure).map(([name, files]) => ({
            type: 'folder',
            name: name,
            children: files.map(doc => ({ type: 'file', ...doc }))
        }));
        container.innerHTML = createTreeHTML(nodes);
        addFileClickListeners(container);
        addToggleListeners(container);
    }

    // --- Data Grouping ---

    function groupAllFiles(docs) {
        // Assuming a flat structure under 'research' for now
        return [{
            type: 'folder',
            name: 'research',
            children: docs.map(doc => ({ type: 'file', ...doc }))
        }];
    }

    function groupByCategory(docs) {
        const categories = {};
        docs.forEach(doc => {
            doc.categories.forEach(cat => {
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(doc);
            });
        });
        return categories;
    }

    function groupByTag(docs) {
        const tags = {};
        docs.forEach(doc => {
            doc.tags.forEach(tag => {
                if (!tags[tag]) tags[tag] = [];
                tags[tag].push(doc);
            });
        });
        return tags;
    }

    // --- Event Listeners ---

    function addFileClickListeners(container) {
        container.querySelectorAll('.file a').forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const filename = link.dataset.filename;
                const title = link.dataset.title;
                viewDocument(filename, title);
            });
        });
    }

     function addToggleListeners(container) {
        container.querySelectorAll('details summary').forEach(summary => {
            summary.addEventListener('click', (event) => {
                // Basic toggle functionality is handled by <details>, but we manage the icon
                const detailsElement = summary.parentElement;
                const toggleBtn = summary.querySelector('.toggle-btn');
                if (toggleBtn) {
                     // Check open state *after* the click event resolves
                    setTimeout(() => {
                         toggleBtn.textContent = detailsElement.open ? '▼' : '▶';
                    }, 0);
                }
            });
        });
    }

    // Tab switching functionality
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // --- Document Viewer ---

    async function viewDocument(filename, title) {
        titleElement.textContent = title;
        contentElement.innerHTML = 'Loading document...'; // Use innerHTML for potential Markdown rendering
        viewer.classList.remove('hidden');

        const docData = allDocuments.find(doc => doc.filename === filename);
        updateMetadata(docData);

        try {
            const response = await fetch(`/research/${filename}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawMarkdown = await response.text();

            // **TODO: Implement Client-Side Markdown Rendering**
            // Replace the line below with a call to a Markdown library like marked.js or markdown-it
            // Example using marked (if included): contentElement.innerHTML = marked.parse(rawMarkdown);
            contentElement.innerText = rawMarkdown; // Display raw text for now

        } catch (error) {
            contentElement.textContent = 'Error loading document: ' + error.message;
            console.error("Error fetching document content:", error);
        }
    }

    function updateMetadata(metadata) {
        if (!metadata) {
             categoriesContainer.innerHTML = '';
             tagsContainer.innerHTML = '';
             return;
        }
        categoriesContainer.innerHTML = metadata.categories.map(cat => `<span class="category">${cat}</span>`).join(' ');
        tagsContainer.innerHTML = metadata.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ');
    }

    window.closeDocument = function() { // Make globally accessible for inline onclick
        viewer.classList.add('hidden');
    }

    window.editDocument = function() { // Make globally accessible
        alert('Edit functionality placeholder.');
    }

    window.saveToGitHub = function() { // Make globally accessible
        alert('GitHub saving functionality placeholder.');
    }

    // --- Stats ---
    function updateStats() {
        const categorySet = new Set();
        const tagSet = new Set();
        allDocuments.forEach(doc => {
            doc.categories.forEach(cat => categorySet.add(cat));
            doc.tags.forEach(tag => tagSet.add(tag));
        });

        statDocs.textContent = allDocuments.length;
        statCategories.textContent = categorySet.size;
        statTags.textContent = tagSet.size;
    }


    // --- Search ---
    function setupSearch() {
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const query = this.value.toLowerCase().trim();
                // Re-render trees based on filtered data
                const filteredDocs = allDocuments.filter(doc =>
                    doc.title.toLowerCase().includes(query) ||
                    doc.filename.toLowerCase().includes(query)
                );

                renderFileTree(allFilesContainer, groupAllFiles(filteredDocs));
                renderCategorizedTree(byCategoryContainer, groupByCategory(filteredDocs));
                renderCategorizedTree(byTagsContainer, groupByTag(filteredDocs));

                // Expand all details in search results for visibility
                document.querySelectorAll('.tab-content details').forEach(d => d.open = true);
                 document.querySelectorAll('.tab-content .toggle-btn').forEach(btn => btn.textContent = '▼');
            });
        }
    }


    // --- Initialization ---
    fetchData();

});
