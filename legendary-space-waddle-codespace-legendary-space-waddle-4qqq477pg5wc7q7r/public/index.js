const express = require('express')
const app = express()
const fs = require('fs')
const path = require('path')

// Serve static files from the 'public' directory
app.use(express.static('public'))

// Enhanced research directory handling
app.use('/research', (req, res, next) => {
  // If requesting the directory itself, serve the index page
  if (req.path === '/' || req.path === '') {
    return res.sendFile(path.join(__dirname, 'research/index.html'))
  }
  
  // If requesting a markdown file, serve it as raw text
  if (req.path.endsWith('.md')) {
    const mdPath = path.join(__dirname, 'research', req.path);

    fs.readFile(mdPath, 'utf8', (err, content) => {
      if (err) {
        return next(); // Pass to the static handler if file doesn't exist
      }

      // Serve the raw Markdown content
      res.type('text/plain').send(content);
    });

    return;
  }
  
  // For all other requests, use the static middleware
  next()
})

// Static middleware for research folder
app.use('/research', express.static('research'))

// Home route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html')
})

// --- new resilient start logic ---
const basePort = parseInt(process.env.PORT, 10) || 3000

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Wikipedia-style CORE AI app running at http://localhost:${port}`)
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying ${port + 1}…`)
      startServer(port + 1)
    } else {
      throw err
    }
  })
}

startServer(basePort)