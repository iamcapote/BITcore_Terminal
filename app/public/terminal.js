class Terminal {
  constructor(outputSelector, inputSelector) {
    this.output = document.querySelector(outputSelector);
    this.input = document.querySelector(inputSelector);
    this.prompt = document.querySelector('#prompt');
    this.currentPrompt = "> ";
    this.inputEnabled = true;
    
    this.input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        if (!this.inputEnabled) return;
        
        const val = this.input.value;
        this.input.value = '';
        // Display both prompt and input
        this.appendOutput(`${this.currentPrompt}${val}`);
        if (this.inputCallback) {
          this.inputCallback(val);
        }
      }
    });
    
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'progress-bar';
    this.progressBar.innerHTML = `
      <div class="progress-fill"></div>
      <div class="progress-text">Initializing...</div>
    `;
    this.progressBar.style.display = 'none';
    document.body.insertBefore(this.progressBar, document.getElementById('input-container'));

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

  enableInput() {
    this.inputEnabled = true;
    this.input.disabled = false;
    this.input.focus();
  }

  disableInput() {
    this.inputEnabled = false;
    this.input.disabled = true;
  }

  onInput(fn) {
    this.inputCallback = fn;
  }

  showProgressBar() {
    this.progressBar.style.display = 'block';
    document.getElementById('input-container').style.display = 'none';
  }

  hideProgressBar() {
    this.progressBar.style.display = 'none';
    document.getElementById('input-container').style.display = 'flex';
  }

  init() {
    this.clear();
    this.appendOutput("Research CLI Terminal");
    this.appendOutput("---------------------");
    this.appendOutput("Type /research to start a research session");
    this.appendOutput("Initializing connection...");
  }

  clear() {
    this.output.textContent = "";
  }
}
