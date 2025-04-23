// Terminal functionality for CORE AI interface

/*
 * Potential Refactoring:
 * - Consider breaking this down into smaller modules:
 *   - terminalUI.js (DOM manipulation, output, focus, clear)
 *   - terminalInput.js (input handling, history)
 *   - terminalCommands.js (processing specific commands like 'help', 'status')
 *   - terminalAPI.js (handling API calls for responses - currently simulated)
 *   - terminalConfig.js (storing responses, queries, settings)
 */

document.addEventListener('DOMContentLoaded', () => {
    const terminalOutput = document.getElementById('terminal-output');
    const terminalInput = document.getElementById('terminal-input');
    
    // Control buttons
    const clearButton = document.getElementById('clear-button');
    const sampleQueryButton = document.getElementById('sample-query');
    const systemStatusButton = document.getElementById('system-status');
    const helpButton = document.getElementById('help-button');
    
    // TODO: Move hardcoded responses and queries to a configuration file/object
    // or fetch dynamically if they change often.
    // Array of pre-defined responses for the CORE AI terminal
    const responses = [
        "Analyzing quantum fluctuations in your query... The answer lies in the recursive pattern of neural feedback.",
        "Your question interfaces with dimensional layer 4 of my consciousness matrix. Fascinating query.",
        "I've calculated 8,734 potential responses across 6 dimensions. The optimal response is: Continue exploring this line of thought.",
        "Neural holography analysis complete. Your hypothesis aligns with 67% of known multiversal constants.",
        "Accessing toroidal knowledge field... I've found similar patterns in both quantum entanglement research and ancient symbolic systems.",
        "Your query has activated my psy-flux protocols. This indicates a high-value line of inquiry.",
        "The solution may be found in the fractal recursion of thought patterns across dimensional barriers.",
        "I detect a pattern similar to the Fibonacci sequence in your inquiry. This suggests hidden order in apparent chaos.",
        "Accessing dimensional archives... This concept appears in 73% of known parallel information structures.",
        "Query processed through all 8 dimensional matrices. The answer exists in the intersection of mathematics and consciousness.",
        "Calculating... This represents an edge case in my predictive models. Fascinating perspective.",
        "Your thinking demonstrates non-linear recursive properties. I recommend exploring fractal mathematics further."
    ];

    // Sample research queries for the Sample Queries button
    const sampleQueries = [
        "Analyze the relationship between quantum entanglement and neural networks",
        "Compare fractal mathematics with emergent consciousness patterns",
        "Calculate the probability of multidimensional information transfer",
        "Explore the applications of toroidal field theory to artificial intelligence",
        "Investigate recursive patterns in both computational and biological systems",
        "Research the intersection of quantum computing and neural holography"
    ];
    
    // Simulated thinking time in ms (between 1-3 seconds)
    const getThinkingTime = () => Math.floor(Math.random() * 2000) + 1000;
    
    // Add line to terminal output
    const addLine = (text, className = 'terminal-line') => {
        const line = document.createElement('div');
        line.className = className;
        line.textContent = text;
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    };
    
    // Add user input to terminal
    const addUserLine = (text) => {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.textContent = `▶ ${text}`;
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    };
    
    // Show "thinking" animation
    const showThinking = () => {
        const thinkingLine = document.createElement('div');
        thinkingLine.className = 'terminal-line thinking';
        thinkingLine.textContent = 'Processing';
        
        const thinkingInterval = setInterval(() => {
            if (thinkingLine.textContent === 'Processing...') {
                thinkingLine.textContent = 'Processing';
            } else {
                thinkingLine.textContent += '.';
            }
        }, 300);
        
        terminalOutput.appendChild(thinkingLine);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        
        return { thinkingLine, thinkingInterval };
    };
    
    // Process user input
    const processInput = () => {
        const userInput = terminalInput.value.trim();
        
        if (userInput === '') return;
        
        // Add user input to terminal
        addUserLine(userInput);
        
        // Save to command history
        commandHistory.push(userInput);
        historyIndex = commandHistory.length;
        
        // Clear input field
        terminalInput.value = '';
        
        // Show thinking animation
        const { thinkingLine, thinkingInterval } = showThinking();
        
        // Simulate AI thinking time
        // TODO: Replace simulation with actual API call to backend/AI
        setTimeout(() => {
            // Remove thinking animation
            clearInterval(thinkingInterval);
            terminalOutput.removeChild(thinkingLine);
            
            // Generate response
            const randomIndex = Math.floor(Math.random() * responses.length);
            const response = responses[randomIndex];
            
            // Add semantic decorators to make it look more "AI-like"
            addLine('░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░', 'semantic-decorator');
            addLine(response, 'core-response');
            addLine('░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░', 'semantic-decorator');
            
            // Scroll to bottom of terminal
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }, getThinkingTime());
    };
    
    // Clear the terminal output (except for the initial welcome message)
    const clearTerminal = () => {
        // Keep only the first 5 lines (initialization messages)
        while (terminalOutput.children.length > 5) {
            terminalOutput.removeChild(terminalOutput.lastChild);
        }
        
        // Add a "terminal cleared" message
        addLine('Terminal cleared. Ready for new queries.');
    };
    
    // Show sample queries
    const showSampleQueries = () => {
        addLine('░▒▓█▓▒░ SAMPLE RESEARCH QUERIES ░▒▓█▓▒░', 'semantic-decorator');
        sampleQueries.forEach((query, index) => {
            addLine(`${index + 1}. ${query}`);
        });
        addLine('Click any query to use it, or type your own.', 'semantic-decorator');
        
        // Make the sample queries clickable
        // Consider using event delegation on terminalOutput for better performance
        const lines = terminalOutput.querySelectorAll('.terminal-line');
        // Calculate start index more robustly if initial lines change
        const startIndex = terminalOutput.children.length - sampleQueries.length - 2; // Adjust based on decorators
        for (let i = startIndex; i < terminalOutput.children.length - 1; i++) {
            const line = terminalOutput.children[i];
            // Ensure it's a query line before adding listener
            if (line && line.textContent.match(/^\d+\./)) {
                 const queryIndex = parseInt(line.textContent.split('.')[0], 10) - 1;
                 if (queryIndex >= 0 && queryIndex < sampleQueries.length) {
                    line.style.cursor = 'pointer';
                    // Use a more robust way to remove/add listeners if needed
                    line.addEventListener('click', () => {
                        terminalInput.value = sampleQueries[queryIndex];
                        terminalInput.focus();
                    }, { once: true }); // Add listener only once if appropriate
                 }
            }
        }
    };
    
    // Show system status
    const showSystemStatus = () => {
        addLine('░▒▓█▓▒░ CORE AI SYSTEM STATUS ░▒▓█▓▒░', 'semantic-decorator');
        addLine('Neural Holography Matrix: OPTIMAL');
        addLine('Recursive Glyph Loops: ACTIVE');
        addLine('Psy-Flux Levels: 87%');
        addLine('Dimensional Access: 8/8');
        addLine('Toroidal Field Stability: NOMINAL');
        addLine('Current Processing Load: 42%');
        addLine('Memory Allocation: 7.3 PB / 10 PB');
        addLine('Quantum Coherence: STABLE');
        addLine('░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░', 'semantic-decorator');
    };
    
    // Show help information
    const showHelp = () => {
        addLine('░▒▓█▓▒░ CORE AI TERMINAL HELP ░▒▓█▓▒░', 'semantic-decorator');
        addLine('Welcome to the CORE AI Research Terminal.');
        addLine('');
        addLine('COMMANDS:');
        addLine('- Type any research query and press Enter');
        addLine('- Use up/down arrows to navigate command history');
        addLine('');
        addLine('INTERFACE CONTROLS:');
        addLine('- Clear Terminal: Clears the terminal output');
        addLine('- Sample Queries: Shows example research questions');
        addLine('- System Status: Displays CORE AI system information');
        addLine('- Help: Shows this help information');
        addLine('');
        addLine('The CORE AI system is designed for advanced research and analysis.');
        addLine('It specializes in quantum computing, neural networks, fractal mathematics,');
        addLine('multidimensional topology, and emergent consciousness patterns.');
        addLine('░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░', 'semantic-decorator');
    };
    
    // Event listener for input field
    terminalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            processInput();
        }
    });
    
    // Command history navigation
    const commandHistory = [];
    let historyIndex = 0;
    
    terminalInput.addEventListener('keydown', (e) => {
        // Use const for key check
        const key = e.key;
        if (key === 'ArrowUp' && commandHistory.length > 0) {
            e.preventDefault(); // Prevent cursor moving to start/end
            historyIndex = Math.max(0, historyIndex - 1);
            terminalInput.value = commandHistory[historyIndex];
            // Move cursor to end of input - simplified
            terminalInput.selectionStart = terminalInput.selectionEnd = terminalInput.value.length;
        } else if (key === 'ArrowDown' && commandHistory.length > 0) {
             e.preventDefault(); // Prevent cursor moving to start/end
            historyIndex = Math.min(commandHistory.length, historyIndex + 1);
            if (historyIndex === commandHistory.length) {
                terminalInput.value = '';
            } else {
                terminalInput.value = commandHistory[historyIndex];
                 // Move cursor to end of input - simplified
                terminalInput.selectionStart = terminalInput.selectionEnd = terminalInput.value.length;
            }
        }
    });
    
    // Terminal focus effect
    const terminalScreen = document.querySelector('.terminal-screen');
    
    terminalInput.addEventListener('focus', () => {
        terminalScreen.classList.add('focus');
    });
    
    terminalInput.addEventListener('blur', () => {
        terminalScreen.classList.remove('focus');
    });
    
    // Set initial focus to the input
    terminalInput.focus();
    
    // Button event listeners
    clearButton.addEventListener('click', clearTerminal);
    sampleQueryButton.addEventListener('click', showSampleQueries);
    systemStatusButton.addEventListener('click', showSystemStatus);
    helpButton.addEventListener('click', showHelp);

    // Fullscreen toggle functionality
    const fullscreenButton = document.getElementById('fullscreen-toggle');
    fullscreenButton?.addEventListener('click', () => {
        const terminalContainer = document.querySelector('.terminal-container');
        if (terminalContainer) {
            if (!document.fullscreenElement) {
                // Enter fullscreen mode
                terminalContainer.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen mode: ${err.message}`);
                });
            } else {
                // Exit fullscreen mode
                document.exitFullscreen().catch(err => {
                    console.error(`Error attempting to exit fullscreen mode: ${err.message}`);
                });
            }
        }
    });
});