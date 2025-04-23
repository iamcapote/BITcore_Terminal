# MCP (Model Context Protocol) Admin Guide

This comprehensive guide outlines the setup, administration, and maintenance processes for the MCP application in both development and production environments. It's designed to help administrators effectively manage the system and troubleshoot common issues.

## Table of Contents

1. [Application Overview](#application-overview)
2. [System Requirements](#system-requirements)
3. [Development Environment Setup](#development-environment-setup)
4. [Production Environment Setup](#production-environment-setup)
5. [Administration Tasks](#administration-tasks)
6. [User Management](#user-management)
7. [API Key Management](#api-key-management)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)
10. [Maintenance and Updates](#maintenance-and-updates)

## Application Overview

The MCP (Model Context Protocol) application is a privacy-focused research tool that automates exploring topics in depth. It leverages AI to generate queries, analyze content, and summarize findings while maintaining user privacy through the Brave Search API. 

### Key Features

- **Dual-mode operation**: Runs in both CLI and Web interfaces
- **Privacy-focused research**: Uses Brave Search API with minimal data collection
- **AI-enhanced insights**: Uses Venice AI to analyze and synthesize findings
- **User authentication**: Supports multiple user roles (Public, Client, Admin)
- **API key management**: Secure storage and management of API credentials
- **Token classification**: Enhances research quality through metadata analysis

### Application Architecture

The application follows a modular structure:
- **Commands**: CLI commands for research, user management, etc.
- **Features**: Core application features (research, auth, etc.)
- **Infrastructure**: Low-level implementations of features
- **Public**: Web interface components
- **Utils**: Utility functions used throughout the application

## System Requirements

### Minimum Requirements

- **Node.js**: v16.x or higher
- **NPM**: v8.x or higher
- **Disk Space**: At least 500MB available
- **Memory**: Minimum 1GB RAM, recommended 2GB+
- **APIs**: Access to Venice API and Brave Search API

### API Requirements

The application requires the following API keys:
- **Venice API**: For AI processing and token classification
- **Brave Search API**: For privacy-focused web searches

## Development Environment Setup

Follow these steps to set up a development environment for MCP:

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/mcp.git
cd mcp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory with the following variables:

```
PORT=3000
BRAVE_API_KEY=your_brave_api_key
VENICE_API_KEY=your_venice_api_key
NODE_ENV=development
```

### 4. Create Admin User

When running the application for the first time, create an admin user:

```bash
node app/start.mjs cli
```

Then in the CLI mode:

```
/users create admin --role=admin
```

You'll be prompted to set a password for the admin user.

### 5. Run in Development Mode

```bash
npm run dev
```

This starts the application in development mode with hot-reloading.

## Production Environment Setup

Follow these steps to deploy MCP in a production environment:

### 1. Server Requirements

- **OS**: Linux (Ubuntu 20.04 LTS or similar)
- **Node.js**: v16.x LTS or higher
- **Process Manager**: PM2 recommended
- **Web Server**: Nginx (for reverse proxy)
- **HTTPS**: SSL certificate required

### 2. Clone and Install

```bash
git clone https://github.com/your-org/mcp.git
cd mcp
npm install --production
```

### 3. Configure Environment Variables

Create a `.env` file:

```
PORT=3000
BRAVE_API_KEY=your_brave_api_key
VENICE_API_KEY=your_venice_api_key
NODE_ENV=production
```

### 4. Setup Process Manager (PM2)

Install PM2:

```bash
npm install -g pm2
```

Create an ecosystem file `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'mcp',
    script: 'app/start.mjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

Start the application:

```bash
pm2 start ecosystem.config.js
```

Set up PM2 to start on system boot:

```bash
pm2 startup
pm2 save
```

### 5. Configure Nginx as Reverse Proxy

Install Nginx:

```bash
sudo apt install nginx
```

Create a site configuration in `/etc/nginx/sites-available/mcp`:

```nginx
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
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/mcp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Configure SSL with Certbot

Install Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
```

Obtain and configure SSL:

```bash
sudo certbot --nginx -d yourdomain.com
```

## Administration Tasks

### Starting and Stopping the Application

In development:
```bash
# Start
npm start

# Start CLI mode
npm start -- cli

# Stop
Ctrl+C
```

In production (with PM2):
```bash
# Start
pm2 start mcp

# Stop
pm2 stop mcp

# Restart
pm2 restart mcp

# Check status
pm2 status
```

### Viewing Logs

In development:
```bash
# View console output directly
```

In production:
```bash
# View application logs
pm2 logs mcp

# View recent logs
pm2 logs mcp --lines 100
```

### Backup and Restore

#### Backup

Backup the user data directory:
```bash
tar -czf mcp-users-backup.tar.gz ~/.mcp/users
```

Backup research results:
```bash
tar -czf mcp-research-backup.tar.gz ./research
```

#### Restore

Restore user data:
```bash
tar -xzf mcp-users-backup.tar.gz -C /
```

Restore research results:
```bash
tar -xzf mcp-research-backup.tar.gz
```

## User Management

### User Roles

The MCP application supports three user roles:

1. **Public (Default)**
   - Limited to 3 queries per hour
   - Research depth: max 2
   - Research breadth: max 3
   - Cannot store API keys
   - Uses shared public API keys

2. **Client**
   - 20 queries per day
   - Research depth: max 3
   - Research breadth: max 5
   - Can store encrypted API keys
   - Must provide own API keys

3. **Admin**
   - 100 queries per day
   - Research depth: max 5
   - Research breadth: max 10
   - Can manage other user accounts
   - Full system access

### User Management Commands

#### Creating Users

Only admin users can create new users:

```
/users create <username> --role=<role>
```

Replace `<username>` with the desired username and `<role>` with one of: `client`, `admin`.

Example:
```
/users create researcher --role=client
```

#### Checking Status

Any user can check their current status:

```
/status
```

This displays:
- Current username
- Role
- API key status
- Research limits

### User Authentication

#### Logging In

```
/login <username>
```

You'll be prompted to enter your password.

#### Logging Out

```
/logout
```

#### Changing Password

```
/password-change
```

You'll be prompted for your current password and new password.

## API Key Management

### Setting API Keys

Users must set their API keys before performing research:

```
/keys set --venice=<venice_api_key> --brave=<brave_api_key>
```

Alternatively, enter interactive mode:
```
/keys set
```

You'll be prompted to enter each key.

### Checking API Key Status

```
/keys check
```

This shows which API keys are configured.

### Testing API Keys

Validate that your API keys are working correctly:

```
/keys test
```

## Troubleshooting

### Common Issues and Solutions

#### Application Won't Start

1. **Check node version**:
   ```bash
   node --version
   ```
   Ensure it's v16.x or higher.

2. **Check for .env file**:
   Ensure the `.env` file exists with the correct variables.

3. **Check port availability**:
   ```bash
   sudo lsof -i :3000
   ```
   Ensure no other service is using the port.

#### Research Command Fails

1. **Check API keys**:
   Run `/keys check` and `/keys test` to verify API keys are working.

2. **Check internet connectivity**:
   The application needs internet access for Brave and Venice APIs.

3. **Check rate limits**:
   You may have exceeded the rate limits for your role.

#### User Can't Log In

1. **Verify username**:
   Check that the username exists with `/users list` (admin only).

2. **Reset password**:
   Admin can reset a user's password:
   ```
   /users reset-password <username>
   ```

#### Web Interface Not Loading

1. **Check server status**:
   ```bash
   pm2 status mcp
   ```

2. **Check Nginx configuration**:
   ```bash
   sudo nginx -t
   ```

3. **Check logs**:
   ```bash
   pm2 logs mcp
   ```

## Security Considerations

### API Key Protection

- API keys are encrypted using AES-256-GCM
- Keys are stored in the user's home directory (`~/.mcp/users`)
- Each user's keys are encrypted with their password
- API keys are never logged or exposed in plaintext

### Password Security

- Passwords are hashed using bcrypt
- Failed login attempts are rate-limited
- Consider implementing a password policy (min length, complexity)

### Server Hardening

For production environments:

1. **Firewall Configuration**:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 22/tcp
   sudo ufw enable
   ```

2. **Regular Updates**:
   ```bash
   sudo apt update
   sudo apt upgrade
   ```

3. **Secure SSH**:
   Edit `/etc/ssh/sshd_config` to:
   - Disable root login
   - Use key-based authentication
   - Change default port

## Maintenance and Updates

### Updating the Application

```bash
# Pull latest changes
git pull

# Install dependencies
npm install

# Restart application
pm2 restart mcp
```

### Monitoring

Set up monitoring tools:

1. **PM2 Monitoring**:
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

2. **System Monitoring** (optional):
   Consider installing tools like:
   - Netdata: `bash <(curl -Ss https://my-netdata.io/kickstart.sh)`
   - Grafana/Prometheus: For comprehensive monitoring

### Regular Backups

Set up a cron job for automatic backups:

```bash
crontab -e
```

Add:
```
0 2 * * * tar -czf /backup/mcp-users-$(date +\%Y\%m\%d).tar.gz ~/.mcp/users
0 2 * * * tar -czf /backup/mcp-research-$(date +\%Y\%m\%d).tar.gz /path/to/mcp/research
```

This creates daily backups at 2 AM.

### Log Rotation

For Nginx logs:
```bash
sudo nano /etc/logrotate.d/nginx
```

Configure to rotate logs weekly or when they exceed a certain size.

---

This guide covers the essential aspects of setting up, managing, and maintaining the MCP application. For additional support or questions, refer to the documentation or contact the development team.

# MCP Admin Guide

This guide provides detailed instructions for setting up, managing, and maintaining the MCP application in both development and production environments.

## Initial Setup

### One-Time Admin Creation

When starting the application for the first time, the system will check if an admin user exists. If no admin is found, you will be prompted to create one. Follow these steps:

1. Run the application:
   ```bash
   node app/start.mjs
   ```

2. Enter the admin username and password when prompted.

3. The admin user will be created, and you can log in using the provided credentials.

This process will only occur once. If an admin user already exists, the application will proceed as usual.

### First-Time Admin Creation

1. Start the application in CLI mode:
   ```bash
   node app/start.mjs cli
   ```

2. If no admin user exists, the system will prompt you to create one. Follow the instructions to set up the admin account.

3. Use the default admin credentials to log in:
   ```bash
   /login admin
   ```
   The default password is `adminpassword`. Change it immediately using:
   ```bash
   /password-change
   ```

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/mcp.git
   cd mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application in development mode:
   ```bash
   npm run dev
   ```

## Production Setup

1. Follow the steps in the [Production Environment Setup](#production-environment-setup) section of the main guide.

2. Ensure the admin account is created during the first run.

## User Management

- **Create Users**: Use `/users create <username> --role=<role>`.
- **Change Password**: Use `/password-change`.
- **Check Status**: Use `/status`.

## Troubleshooting

- **Cannot Access Research**: Ensure you are logged in as a non-public user.
- **Forgot Admin Password**: Delete the `admin.json` file in the user directory and restart the application to recreate the admin account.

For more details, refer to the full documentation.