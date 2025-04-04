class Terminal {
  constructor(outputSelector, inputSelector) {
    this.output = document.querySelector(outputSelector);
    this.input = document.querySelector(inputSelector);
    this.prompt = document.querySelector('#prompt');
    this.currentPrompt = "> ";
    
    this.input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        const val = this.input.value;
        this.input.value = '';
        // Display both prompt and input
        this.appendOutput(`${this.currentPrompt}${val}`);
        if (this.inputCallback) {
          this.inputCallback(val);
        }
      }
    });
    
    console.log("Terminal initialized");
  }

  appendOutput(text) {
    if (text) {
      this.output.textContent += `${text}\n`;
      this.output.scrollTop = this.output.scrollHeight;
    }
  }

  updateLastLine(text) {
    let lines = this.output.textContent.split('\n');
    if (lines.length > 0) {
      // Find the last non-empty line to update
      let lastLineIndex = lines.length - 1;
      while (lastLineIndex >= 0 && !lines[lastLineIndex].trim()) {
        lastLineIndex--;
      }
      
      if (lastLineIndex >= 0) {
        lines[lastLineIndex] = text;
      } else {
        lines.push(text);
      }
      
      this.output.textContent = lines.join('\n');
    } else {
      this.output.textContent = text + '\n';
    }
    this.output.scrollTop = this.output.scrollHeight;
  }
  
  setPrompt(promptText) {
    this.currentPrompt = promptText || "> ";
    this.prompt.textContent = this.currentPrompt;
    this.input.focus();
  }

  onInput(fn) {
    this.inputCallback = fn;
  }

  init() {
    this.clear();
    this.appendOutput("Research CLI Terminal");
    this.appendOutput("---------------------");
    this.appendOutput("Initializing connection...");
  }

  clear() {
    this.output.textContent = "";
  }
}
