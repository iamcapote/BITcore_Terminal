import fs from 'node:fs/promises';
import pathModule from 'node:path';
import urlModule from 'node:url';

// Get current execution context
const __filename = urlModule.fileURLToPath(import.meta.url);
const __dirName = pathModule.dirname(__filename);

async function generateFileStructure(startDirectory) {
  const entries = await fs.readdir(startDirectory);

  return entries.reduce(async (accPromise, item) => {
    const accStr = await accPromise;

    const fullPath = pathModule.join(startDirectory, item);
    let stats;

    try {
      stats = await fs.stat(fullPath);
      // Skip hidden/system files if needed：
      // if(item.startsWith('.')) return accStr;
    } catch (e) {
      console.warn(`Skipping ${fullPath}`);
      return accStr; // Skip unreadable items
    }

    let entryText = `${' '.repeat((arguments[1] || 0) * 2)}${item}${stats.isDirectory() ? '/' : ''}`;

    if (stats.isDirectory()) {
      const subdirContent = await generateFileStructure(
        fullPath,
        typeof arguments[1] === 'number' ? arguments[1] + 1 : 1,
      );
      entryText += `\n${subdirContent}`;
    }

    return `${accStr}${entryText}\n`;
  }, '');
}

// Execution block ---------------------------
(async () => {
  try {
    // Start exactly in THIS application's root dir：
    const projectRoot = __dirName;

    console.log(`Generating tree rooted at： ${projectRoot}`);

    await fs.access(projectRoot);

    const finalOutput = `# Current APP Folder File Tree\n\n\`\`\`plaintext\n${await generateFileStructure(
      projectRoot,
    )}\n\`\`\``;

    await fs.writeFile(
      pathModule.join(projectRoot, 'current_app_folder_file_tree.md'),
      finalOutput,
      { encoding: 'utf8', flag: 'w+' },
    );

    console.log('✅ Saved successfully!');
  } catch (error) {
    console.error('Error:', error.message || error.toString());
    process.exit(1);
  }
})();
