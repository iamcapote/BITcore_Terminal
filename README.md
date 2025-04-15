# Deep Research Privacy App

The Deep Research Privacy App is a privacy-focused research tool that automates exploring topics in depth. It uses the Brave Search API along with optional token classification from the Venice LLM API. The app supports both CLI and browser-based terminal interfaces, letting you securely perform research, manage accounts, and enhance queries with metadata from external APIs.

---

## Table of Contents
1. [Overview](#overview)  
2. [Features](#features)  
3. [File Structure](#file-structure)  
4. [Usage Modes](#usage-modes)  
5. [Authentication System](#authentication-system)  
6. [Research Pipeline](#research-pipeline)  
7. [API Key Management](#api-key-management)  
8. [Token Classification Module](#token-classification-module)  
9. [Chat and Memory System](#chat-and-memory-system)
10. [Running the App](#running-the-app)  
11. [Production Deployment](#production-deployment)  
12. [Security Considerations](#security-considerations)  
13. [Troubleshooting](#troubleshooting)  
14. [Validation & Accuracy Check](#validation--accuracy-check)

---

## Overview
This application automates research using AI-driven querying and summarization. It supports both public use (with limited features) and authenticated users (client or admin) who can store their own encrypted API keys. The app integrates seamlessly with the Venice API for optional token classification, adding metadata to strengthen query context. The newly implemented chat system enables interactive conversations with memory retention capabilities and seamless transition to deep research.

---

## Features
1. **Dual-Mode Application**  
   - Runs in Server Mode or CLI Mode.  
   - Server Mode: Provides a web interface at http://localhost:3000 and an API endpoint at /api/research.  
   - CLI Mode: Interactive text-based prompts for research operations.

2. **Web-Based Terminal Interface**  
   - Real-time output via WebSockets.  
   - Optional token classification toggle.  
   - Interactive session that mirrors CLI workflow.

3. **Research Engine**  
   - Generates multiple queries (breadth) and follow-ups (depth).  
   - Uses Brave Search for retrieving results.  
   - Summarizes findings via AI, storing summaries, sources, and learnings.

4. **Token Classification**  
   - Optional module forwarding user queries to the Venice API.  
   - Embeds metadata in the research query for improved relevance.  
   - Fully integrated into CLI and Web workflows.

5. **Authentication & User Management**  
   - Three roles: Public, Client, and Admin.  
   - File-based user profiles stored at ~/.mcp/users.  
   - Session-based authentication with 30-day expiration.

6. **Encrypted API Key Storage**  
   - Each user can configure Brave and Venice API keys.  
   - Keys are AES-256-GCM encrypted with per-user credentials.  
   - Automatic checks to confirm key validity.

7. **Chat System with Memory**  
   - Interactive chat interface with AI-powered responses.
   - Memory management with short, medium, and long-term retention.
   - Seamless integration with research pipeline for knowledge exploration.
   - Memory summarization and validation for high-quality contextual awareness.

8. **Logging & Error Handling**  
   - Detailed logs for search operations, classification steps, and research progress.  
   - Automatic rate-limiting and retry logic for external APIs.

---

## File Structure
```plaintext
app/
  commands/
    admin.cli.mjs
    chat.cli.mjs            # Chat implementation with memory and research integration
    diagnose.cli.mjs
    index.mjs
    keys.cli.mjs
    login.cli.mjs
    logout.cli.mjs
    password.cli.mjs
    research.cli.mjs
    status.cli.mjs
    users.cli.mjs

  features/
    ai/
      research.providers.mjs       # AI-based research providers
    auth/
      encryption.mjs               # AES-256-GCM encryption utilities
      user-manager.mjs             # File-based user & session management
    research/
      research.controller.mjs      # Controller for research requests
      routes.mjs                   # Research-related Express routes with WebSocket handlers

  infrastructure/
    ai/
      venice.llm-client.mjs        # Venice LLM API client
      venice.response-processor.mjs
    memory/
      github-memory.integration.mjs # Integration with GitHub for long-term memory
      memory.manager.mjs           # Memory system with layered storage architecture
    research/
      research.engine.mjs          # Main research engine logic
      research.path.mjs            # Research path manager
    search/
      search.providers.mjs         # Brave Search provider with retry logic
    ...

  public/
    chat.js                        # Client-side chat interface
    index.html                     # Web-based terminal UI
    research.js                    # Client-side script for research session
    terminal.js                    # Basic terminal emulation

  tests/
    brave-provider.test.mjs
    brave-search-provider.test.mjs
    chat.test.mjs                  # Tests for chat functionality
    ...

  utils/
    token-classifier.mjs           # For sending queries to Venice API
    research.clean-query.mjs
    research.output-manager.mjs
    research.rate-limiter.mjs
    ...

start.mjs                          # Entry point (handles both server & CLI)
README.md                          # Documentation (MASTER source of all info)
```

---

## Usage Modes
1. **Server Mode (Default)**  
   Runs an Express server on port 3000 (configurable via PORT). Access the web UI at http://localhost:3000. WebSocket connections provide real-time logs and prompts.

2. **CLI Mode**  
   Launch using:  
   » npm start -- cli  
   or:  
   » node app/start.mjs cli  
   Follow interactive prompts for query, depth, breadth, and optional token classification.

---

## Authentication System
1. **Roles & Permissions**  
   - **Public**: No login needed, restricted to depth 2 / breadth 3, limited queries.  
   - **Client**: Must log in. Can store personal API keys, has moderate usage.  
   - **Admin**: Full privileges, can create/manage users, highest usage limits.

2. **User Management**  
   - Users stored under ~/.mcp/users/<username>.json.  
   - Create users with “/users create <username> --role=<role>” (admin only).

3. **Session Management**  
   - Sessions last 30 days by default.  
   - Automatic expiration plus manual logout with “/logout”.  
   - After logout, the system reverts to public mode.

4. **Authentication Commands**  
   - /login <username>  
   - /logout  
   - /status  
   - /users create <username> --role=<role> (admin only)  
   - /password-change  

---

## Research Pipeline

### Research Pipeline Overview

The research pipeline follows these steps:
1. User input is gathered.
2. Metadata is generated using the token classifier.
3. The input and metadata are sent to Venice to generate search queries, both with and without SearchFu techniques.
4. These queries are separated and sent to Brave one by one for research.
5. The findings are processed, detailed, and gathered.
6. A summary is generated and exported.

**Note:** The token classifier is only used to generate metadata, and the metadata is combined with the user input to create detailed search queries. User input + metadata is never sent directly to Brave.

---

## API Key Management
1. **Key Setup**  
   - /keys set --venice=<key> --brave=<key>  
   - Keys are stored encrypted per user.  
   - The app defaults to environment variables when no user keys are available.

2. **Key Checks**  
   - /keys check  
   - /keys test  
   Both display or validate the stored keys.

3. **Encryption**  
   - AES-256-GCM with salts per user.  
   - Requires password to decrypt keys each session.

---

## Token Classification Module
1. **Purpose**  
   - Forwards user queries to Venice’s LLM endpoint.  
   - Returns classification metadata, merged into the original query.  
   - Improves context for searching and summarizing.

2. **Integration**  
   - CLI prompts “yes/no” for using token classification.  
   - In the web UI, toggle “Enhance with token classification.”  
   - If classification fails, the pipeline continues with the raw query.

3. **Implementation**  
   - callVeniceWithTokenClassifier(query) in token-classifier.mjs.  
   - Attaches plain text metadata to the inbound query object.

---

## Chat and Memory System

The chat and memory system provides a sophisticated interface for conversing with the AI while maintaining context through an advanced memory architecture.

### Chat Commands
1. **Starting Chat**
   - `/chat` - Starts a basic chat session
   - `/chat --memory=true` - Starts a chat with memory enabled
   - `/chat --depth=short|medium|long` - Control memory depth (default: medium)
   - `/chat --verbose` - Enables detailed logging

2. **In-Chat Commands**
   - `/exit` - End the chat session
   - `/exitmemory` - Finalize memories and exit memory mode
   - `/research` - Generate research queries from chat context

3. **Memory Architecture**
   - **Short-term memory**: Retains recent conversation context (10-50 messages)
   - **Working memory**: Real-time ephemeral data processed during conversation
   - **Long-term memory**: Validated and scored knowledge (persistent storage)
   - **Meta memory**: Summarized insights and higher-order knowledge (persistent)

### Memory Subsystem Integration
The memory system is inspired by human cognition and computational memory hierarchies:

1. **Memory Layers**
   - Memory is organized in layers with different retention periods and thresholds
   - Memories flow from ephemeral (short-term) to persistent (long-term) based on relevance
   - Each layer uses adaptive thresholds for filtering and retrieval

2. **Memory Validation and Processing**
   - Raw messages are sent to Venice LLM for scoring (0-1) and tagging
   - Context-aware validation ensures high-quality memory retention
   - Three actions applied to memories: retain, summarize, or discard
   - Periodic summarization combines related memories into meta-memories

3. **Semantic Retrieval Algorithm**
   - Two-tier retrieval strategy with advanced semantic matching
   - Primary: LLM-based scoring for high-precision semantic matching
   - Fallback: Local Jaccard similarity with tag-boosting and recency weighting
   - Memory retrieval adapts to conversation context and query relevance

4. **GitHub Integration for Persistent Storage**
   - Long-term and meta memories stored in structured GitHub repositories
   - Memory entries tagged with metadata including scores, timestamps, and context
   - Registry files (`long_term_registry.md` and `meta_memory_registry.md`) maintain organization
   - Local fallback storage when GitHub is unavailable

### Inference Points and AI Integration
The chat system leverages Venice LLM at key inference points:

1. **Automated Query Generation**
   - Chat context and memory blocks are analyzed to extract key research topics
   - Venice LLM generates optimized search queries based on conversation context
   - Generated queries are passed to the research pipeline for execution

2. **Memory Processing**
   - Pre-validation of user input determines relevance and quality
   - Meta-analysis determines whether to summarize or retain raw memories
   - Periodic validation ensures memory consistency and quality

3. **Context Management**
   - Memory injection based on context relevance and threshold settings
   - Automatic memory finalization for inactive sessions
   - Memory summarization when threshold of similar topics is reached

### Research Integration
The chat system seamlessly integrates with the research pipeline, allowing users to:
1. Have a conversation about any topic
2. Use the `/research` command to extract key topics
3. Automatically generate optimized research queries
4. Execute in-depth research directly from the conversation context
5. Store research findings back into memory for future reference

This integration creates a powerful knowledge-building loop where conversation insights lead to deeper research, which in turn enriches future conversations through the memory system.

### Using the Chat System
1. **Basic Chat**
   ```
   /chat
   > Tell me about quantum computing
   > /exit
   ```

2. **Chat with Memory**
   ```
   /chat --memory=true --depth=medium
   > Tell me about quantum computing
   > What are qubits exactly?
   > /research
   > /exitmemory
   > /exit
   ```

3. **Advanced Memory Controls**
   ```
   /chat --memory=true --depth=long --store=true --retrieve=false
   > Tell me about the history of artificial intelligence
   > How has deep learning changed AI research?
   > /exitmemory
   ```
   This example enables long-term memory storage but disables memory retrieval for the session.

4. **Web Interface**
   The chat interface is also available through the web terminal, with identical functionality and command structure.

---

## Running the App
1. **Install Dependencies**  
   » npm install  

2. **Set Environment Variables**  
   Create a .env file with:  
   PORT=3000  
   BRAVE_API_KEY=your_brave_api_key  
   VENICE_API_KEY=your_venice_api_key  

3. **Start in Server Mode**  
   » npm start  
   Access http://localhost:3000 in a browser.

4. **Start in CLI Mode**  
   » npm start -- cli  
   Follow the interactive text-based session.

---

## Production Deployment
1. **Install Dependencies**  
   » npm install --production  

2. **Process Manager (e.g., PM2)**  
   » pm2 start app/start.mjs --name mcp  
   » pm2 startup  
   » pm2 save  

3. **Nginx Reverse Proxy (Example)**  
   server {  
       listen 80;  
       server_name yourdomain.com;  
       location / {  
           proxy_pass http://localhost:3000;  
           proxy_http_version 1.1;  
           proxy_set_header Upgrade $http_upgrade;  
           proxy_set_header Connection 'upgrade';  
           proxy_set_header Host $host;  
           proxy_cache_bypass $http_upgrade;  
       }  
   }

4. **SSL with Certbot**  
   » sudo certbot --nginx -d yourdomain.com  

---

## Security Considerations
- **API Key Protection**: Keys are AES-256-GCM encrypted with per-user salts and never logged.  
- **Password Security**: Passwords hashed with SHA-256, session tokens expire after 30 days.  
- **Server Hardening**: Use ufw or similar firewall, run the app as a non-root user, keep the OS up to date.  
- **HTTPS**: Required in production to protect sensitive data.

---

## Troubleshooting
1. **Application Won’t Start**  
   - Check Node.js version (v16+).  
   - Confirm BRAVE_API_KEY and VENICE_API_KEY in the environment.  

2. **Research Command Fails**  
   - Verify you have valid keys: “/keys check” and “/keys test”.  
   - Ensure no rate limit or network issues.

3. **User Can’t Log In**  
   - Confirm user file ~/.mcp/users/<username>.json exists.  
   - If admin is lost, remove admin.json to recreate admin on next start.

4. **Web Interface Not Loading**  
   - Check pm2 status or console logs.  
   - Verify Nginx configuration with “nginx -t”.

---

## Validation & Accuracy Check
All functionality, including token classification and user management, has been cross-verified with the source code. This README serves as the sole reference for full application details. All other Markdown documentation is consolidated into this single reference.
