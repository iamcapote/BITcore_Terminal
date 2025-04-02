export class OutputManager {
    constructor() {
      this.spinnerStates = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      this.spinnerIndex = 0;
      this.spinnerInterval = setInterval(() => {
        this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerStates.length;
      }, 80);
    }
  
    log(...args) {
      console.log(...args);
    }
  
    updateProgress(progress) {
      const totalSteps = progress.totalDepth * progress.totalBreadth;
      const completedSteps = progress.completedQueries || 0;
      const percent = Math.round((completedSteps / totalSteps) * 100);
      const bar = `[${'█'.repeat(percent / 5)}${'░'.repeat(20 - percent / 5)}]`;
      process.stdout.write(`\rProgress: ${bar} ${percent}%`);
    }
  
    cleanup() {
      clearInterval(this.spinnerInterval);
    }
  }
  
  export const output = new OutputManager();
  