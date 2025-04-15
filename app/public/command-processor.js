/**
 * Command Processor
 * 
 * Handles the execution and processing of commands for the web terminal.
 */
class CommandProcessor {
  constructor() {
    this.commands = {
      'help': this.executeHelp.bind(this),
      'login': this.executeLogin.bind(this),
      'logout': this.executeLogout.bind(this),
      'status': this.executeStatus.bind(this),
      'users': this.executeUsers.bind(this),
      'keys': this.executeKeys.bind(this),
      'research': this.executeResearch.bind(this),
      'chat': this.executeChat.bind(this),
      'exitmemory': this.executeExitMemory.bind(this),
      'password-change': this.executePasswordChange.bind(this)
    };
    
    // Track if we're waiting for password input
    this._pendingPasswordResolve = null;
    
    // Track commands in progress
    this.commandsInProgress = new Set();
  }
  
  /**
   * Execute a command
   * 
   * @param {string} command - Command string to execute
   * @returns {Promise<Object>} Command result
   */
  async executeCommand(command) {
    // Parse command string
    const parts = command.trim().split(' ');
    const cmd = parts[0].startsWith('/') ? parts[0].substring(1) : parts[0];
    const args = parts.slice(1);
    
    console.log(`Processing command: ${cmd}`);
    
    // Check if the command is already in progress
    const commandId = `${cmd}-${Date.now()}`;
    if (this.commandsInProgress.has(cmd)) {
      console.log(`Command ${cmd} is already in progress, skipping duplicate`);
      return { success: false, error: `Command ${cmd} is already in progress` };
    }
    
    // Mark command as in progress
    this.commandsInProgress.add(cmd);
    
    try {
      if (this.commands[cmd]) {
        const result = await this.commands[cmd](args);
        return result;
      } else {
        // Send unknown commands to the server
        await webcomm.sendCommand(command);
        return { success: true };
      }
    } catch (error) {
      console.error(`Error executing command '${cmd}':`, error);
      return { success: false, error: error.message };
    } finally {
      // Mark command as complete
      this.commandsInProgress.delete(cmd);
    }
  }

  /**
   * Centralized method to execute commands with input locking.
   * Ensures input is disabled during execution and re-enabled after completion.
   * 
   * @param {Function} commandFn - The command function to execute.
   * @returns {Promise<Object>} Command result
   */
  async executeWithInputLock(commandFn) {
    try {
      if (window.terminal) {
        window.terminal.disableInput(); // Lock input
      }
      return await commandFn();
    } catch (error) {
      console.error('Error during command execution:', error);
      if (window.terminal) {
        window.terminal.appendOutput(`Error: ${error.message}`);
      }
      return { success: false, error: error.message };
    } finally {
      if (window.terminal) {
        window.terminal.enableInput(); // Re-enable input
      }
    }
  }

  // Command implementations
  async executeHelp() {
    await webcomm.sendCommand('/help');
    return { success: true };
  }
  
  async executeLogin(args) {
    const username = args[0];
    if (!username) {
      return { success: false, error: 'Username is required' };
    }
    
    // Prompt for password
    const password = await this.promptForPassword('Please enter your password:');
    
    // Send login command with password
    await webcomm.sendInput(`/login ${username}`, { password });
    
    // Get user status after login
    await webcomm.sendCommand('/status');
    
    return { success: true };
  }
  
  async executeLogout() {
    await webcomm.sendCommand('/logout');
    return { success: true };
  }
  
  async executeStatus() {
    await webcomm.sendCommand('/status');
    return { success: true };
  }
  
  async executeUsers(args) {
    const action = args[0] || 'list';
    
    if (action === 'create' || action === 'add') {
      const username = args[1];
      if (!username) {
        return { success: false, error: 'Username is required' };
      }
      
      let role = 'client';
      for (let i = 2; i < args.length; i++) {
        if (args[i].startsWith('--role=')) {
          role = args[i].split('=')[1];
        }
      }
      
      const password = await this.promptForPassword('Enter password for new user:');
      
      await webcomm.sendInput(`/users create ${username} --role=${role}`, { password });
    } else {
      // Any other action (list, etc)
      await webcomm.sendCommand(`/users ${args.join(' ')}`);
    }
    
    return { success: true };
  }
  
  async executeKeys(args) {
    const action = args[0] || 'check';
    
    if (action === 'set') {
      // Extract key arguments
      const keyArgs = {};
      for (let i = 1; i < args.length; i++) {
        if (args[i].includes('=')) {
          const [key, value] = args[i].split('=');
          keyArgs[key] = value;
        }
      }
      
      // Prompt for password
      const password = await this.promptForPassword('Enter your password to encrypt API keys:');
      
      // Send the keys command with password
      await webcomm.sendInput(`/keys set ${args.slice(1).join(' ')}`, { password });
    } else {
      // For any other keys command
      await webcomm.sendCommand(`/keys ${args.join(' ')}`);
    }
    
    return { success: true };
  }
  
  async executeResearch(args) {
    // Send the research command
    await webcomm.sendCommand(`/research ${args.join(' ')}`);
    return { success: true, mode: 'research' };
  }
  
  async executeChat(args) {
    // Parse memory option
    let memoryOption = '';
    for (let arg of args) {
      if (arg.startsWith('--memory=')) {
        memoryOption = arg;
      }
    }
    
    // Send the chat command
    await webcomm.sendCommand(`/chat ${memoryOption}`);
    
    return { success: true, mode: 'chat' };
  }
  
  async executeExitMemory() {
    await webcomm.sendCommand('/exitmemory');
    return { success: true };
  }
  
  async executePasswordChange() {
    const currentPassword = await this.promptForPassword('Enter your current password:');
    const newPassword = await this.promptForPassword('Enter your new password:');
    
    // Send the password change command with both passwords
    await webcomm.sendInput('/password-change', { currentPassword, newPassword });
    
    return { success: true };
  }
  
  /**
   * Prompt for password input
   * 
   * @param {string} prompt - Text to display for the prompt
   * @returns {Promise<string>} User's password input
   */
  async promptForPassword(prompt) {
    // Display prompt message
    if (window.terminal) {
      window.terminal.setPasswordMode(true);
      window.terminal.appendOutput(prompt);
    }
    
    // Return a promise that will be resolved when password is entered
    return new Promise((resolve) => {
      this._pendingPasswordResolve = resolve;
    });
  }
  
  /**
   * Receive password input from terminal
   * 
   * @param {string} password - Password entered by user
   */
  receivePasswordInput(password) {
    if (this._pendingPasswordResolve) {
      const resolve = this._pendingPasswordResolve;
      this._pendingPasswordResolve = null;
      resolve(password);
    }
  }
}

// Create global instance
window.commandProcessor = new CommandProcessor();