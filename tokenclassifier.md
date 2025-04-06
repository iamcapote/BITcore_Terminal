# Token Classification Module

This module forwards user queries to the Venice API for token classification using an LLM character-slug. The app itself does not perform any classification. Instead, it sends the original user input to Venice, which processes it and returns token classification details. These details are then merged with the original input and forwarded to the research pipeline.

## Integration with Research Pipeline

On submission, the query is sent with a designated token classifier character-slug to Venice. The raw response is attached verbatim to the original input before passing it to the research pipeline. The next step is the normal research pipeline with user input plus token classifier metadata.

### Workflow

1. **User Input**: The user provides a query.
2. **Token Classification**: The query is sent to the Venice API for classification.
3. **Enhanced Query**: The classification metadata is merged with the original query.
4. **Research Pipeline**: The enhanced query is passed to the research engine to generate and process queries.

### Example Integration

```javascript
import { callVeniceWithTokenClassifier } from '../utils/token-classifier.mjs';

async function startResearchPipeline(inputFn, outputFn) {
  const researchQuery = await inputFn('What would you like to research? ');
  let enhancedQuery = { original: researchQuery };

  const useTokenClassifier = await inputFn('Use token classification? (yes/no) [no] ');
  if (useTokenClassifier.toLowerCase() === 'yes') {
    const tokenResponse = await callVeniceWithTokenClassifier(researchQuery);
    enhancedQuery.tokenClassification = tokenResponse;
  }

  // Pass enhancedQuery to the research engine
}
```

### Benefits

- **Enhanced Context**: Token classification provides additional metadata to refine research queries.
- **Seamless Integration**: The module integrates directly into the existing research pipeline.
- **Error Handling**: Robust error handling ensures the app remains stable even if the Venice API fails.

## Implementation Plan

1. Optimize the request forwarding to Venice (classification handled externally).
2. Refactor query enhancement by directly attaching Venice's raw response.
3. Enhance pipeline integration to support responses in any format.
4. Continuously monitor and optimize performance.

## Enhanced Token Classification Module Plan

### Overview

In this refactored design, classification is completely delegated to the Venice API via an LLM character-slug. The app now solely focuses on:
- Forwarding user queries to Venice.
- Receiving Venice’s response—which may be JSON, plain text, or another format.
- Merging these details with the original query before sending the final payload to the research pipeline.

### Architecture Integration
- The module acts strictly as a passthrough for token classification.
- The user input is sent to the Venice API along with the designated token classifier character-slug.
- Venice returns a response with token classification details.
- These details are merged with the original user input and then forwarded to the research pipeline.

## CLI and Web Interface Integration

// For CLI: prompt the user regarding the use of token classification.
```javascript
// filepath: /workspaces/MCP/tokenclassifier.md
async function promptForTokenClassification() {
	// Changed to prompt for a y/n input.
	const answer = await inquirer.prompt([{
		type: 'input',
		name: 'useTokenClassifier',
		message: 'Do you want to enhance your query with token classification? (y/n)',
		validate: input => /^[yYnN]$/.test(input) ? true : "Please enter y or n."
	}]);
	return answer.useTokenClassifier.toLowerCase() === 'y';
}
```

// For Web: add a toggle option in the research options.
```javascript
// filepath: /workspaces/MCP/tokenclassifier.md
function addTokenClassifierOption() {
	const optionsContainer = document.querySelector('.research-options');
	
	const tokenClassifierOption = document.createElement('div');
	tokenClassifierOption.className = 'option-group';
	tokenClassifierOption.innerHTML = `
		<label>
			<input type="checkbox" id="token-classifier-toggle">
			Enhance with token classification
		</label>
		<div class="option-description">
			Forwards your query with a token classifier character to the Venice API for optimized processing.
		</div>
	`;
	
	optionsContainer.appendChild(tokenClassifierOption);
}
```

### Enhanced Logging

- **Token Classification**:
  - Logs every step, including payload sent, response received, and errors encountered.
- **Research Pipeline**:
  - Logs the enhanced query and progress at each stage.

### Connection Handling

- **WebSocket**:
  - Improved reconnection logic with exponential backoff.
  - Clearer messages for connection status.

### CLI and Web-CLI Parity

- Both interfaces now handle token classification and research pipeline execution seamlessly.
- Consistent logging and error handling across both interfaces.
