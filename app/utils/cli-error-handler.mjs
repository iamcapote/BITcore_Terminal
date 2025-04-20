/**
 * Error handling utilities for CLI commands
 * Provides standardized error handling and logging for all CLI commands
 */

import { output } from './research.output-manager.mjs';

// Error types for consistent categorization
export const ErrorTypes = {
  AUTHENTICATION: 'authentication',
  API_KEY: 'api_key',
  INPUT_VALIDATION: 'input_validation',
  NETWORK: 'network',
  SERVER: 'server',
  PERMISSION: 'permission',
  NOT_FOUND: 'not_found',
  UNKNOWN: 'unknown'
};

/**
 * Standardized error handling function for CLI commands
 * 
 * @param {Error|string} error - The error object or message
 * @param {string} errorType - The type of error (from ErrorTypes)
 * @param {Object} options - Additional options
 * @param {boolean} options.verbose - Whether to show verbose error details
 * @param {string} options.command - The command that threw the error
 * @param {string} options.recoveryHint - Hint for how to recover from the error
 * @returns {Object} Standardized error response object
 */
export function handleCliError(error, errorType = ErrorTypes.UNKNOWN, options = {}) {
  const { verbose = false, command = '', recoveryHint = '' } = options;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorDetails = error instanceof Error && error.stack ? error.stack : '';

  output.error(`Error [${errorType}]: ${errorMessage}`);
  if (recoveryHint) output.log(`Hint: ${recoveryHint}`);
  if (verbose && errorDetails) output.error(`Details: ${errorDetails}`);
}

/**
 * Suggest recovery steps based on error type
 * 
 * @param {string} errorType - The type of error (from ErrorTypes)
 * @param {string} command - The command that threw the error
 */
function suggestRecoverySteps(errorType, command) {
  switch (errorType) {
    case ErrorTypes.AUTHENTICATION:
      output.log('Try running "/login" to authenticate your session.');
      break;
    case ErrorTypes.API_KEY:
      output.log('Check your API keys with "/keys check" or set new ones with "/keys set".');
      break;
    case ErrorTypes.INPUT_VALIDATION:
      output.log('Please check your input and try again with valid parameters.');
      break;
    case ErrorTypes.NETWORK:
      output.log('Check your internet connection and try again. If the issue persists, the service may be temporarily unavailable.');
      break;
    case ErrorTypes.PERMISSION:
      output.log('Your account does not have sufficient permissions for this operation.');
      if (command === 'users') {
        output.log('The "users" command requires admin privileges.');
      }
      break;
    case ErrorTypes.NOT_FOUND:
      output.log('The requested resource was not found. Please verify it exists and try again.');
      break;
    default:
      output.log('If this error persists, try running "/diagnose" for system diagnostics.');
  }
}

/**
 * Validate required inputs and handle missing parameters
 * 
 * @param {Object} inputs - Input parameters to validate
 * @param {Array} required - List of required parameter names
 * @param {string} command - The command being validated
 * @returns {Object|null} Error object if validation fails, null if successful
 */
export function validateInputs(inputs, required, command) {
  const missing = required.filter(param => inputs[param] === undefined);
  
  if (missing.length > 0) {
    return handleCliError(
      `Missing required parameters: ${missing.join(', ')}`,
      ErrorTypes.INPUT_VALIDATION,
      { 
        command,
        recoveryHint: `The "${command}" command requires ${missing.join(', ')} parameter(s).`
      }
    );
  }
  
  return null; // Validation successful
}

/**
 * Log the start of a command execution with standardized format
 * 
 * @param {string} command - The command being executed
 * @param {Object} params - The parameters being used
 * @param {boolean} verbose - Whether to show verbose logs
 */
export function logCommandStart(command, params = {}, verbose = false) {
  output.log(`Executing command: ${command}`);
  
  if (verbose) {
    const paramList = Object.entries(params)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
      .join(', ');
      
    output.log(`Parameters: ${paramList || 'none'}`);
  }
}

/**
 * Log successful command completion
 * 
 * @param {string} command - The command that completed
 * @param {Object} result - The result data
 * @param {boolean} verbose - Whether to show verbose logs
 */
export function logCommandSuccess(command, result = {}, verbose = false) {
  output.log(`Command "${command}" completed successfully`);
  
  if (verbose && Object.keys(result).length > 0) {
    output.log('Result:', JSON.stringify(result, null, 2));
  }
}