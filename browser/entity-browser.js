#!/usr/bin/env node

// entity-browser.js

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import { Command } from 'commander'
import open from 'open'
import { Entity, VersionEntity } from '../entityDB.js' // Adjust the path as needed

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize Commander
const program = new Command()

program
  .requiredOption('-d, --db <path>', 'Path to the SQLite database')
  .requiredOption(
    '-e, --entities <entities>',
    'Comma-separated list of entities to inspect'
  )
  .option('-p, --port <number>', 'Port to run the web server on', '3000')
  .parse(process.argv)

// Parse command-line arguments
const options = program.opts()
const dbPath = options.db
const entitiesList = options.entities.split(',')
const port = parseInt(options.port, 10)

// Initialize database connection
const db = new Database(dbPath)

// Create Entity instances for each entity
const entities = {}
for (const entityName of entitiesList) {
  // Determine if the entity is versioned (you might have a way to know this)
  // For demonstration, let's assume entities ending with 'Version' are versioned
  if (entityName.endsWith('Version')) {
    entities[entityName] = new VersionEntity(db, entityName)
  } else {
    entities[entityName] = new Entity(db, entityName)
  }
}

const app = express()

// Set the views directory and template engine
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

// Serve static files (CSS, JS, highlight.js)
app.use(express.static(path.join(__dirname, 'public')))

// Define a helper function for rendering with defaults
function render(res, view, vars) {
  const defaults = {
    entities: null,
    selectedEntity: null,
    ids: null,
    page: 1,
    totalPages: 1,
    selectedItem: null,
    documentContent: null,
    isVersioned: false
  }

  // Merge the provided variables with the defaults
  const templateVars = { ...defaults, ...vars }

  // Render the view with the merged variables
  res.render(view, templateVars)
}

/**
 * Route: Home page
 * Displays the list of entities with their document counts.
 */
app.get('/', (req, res) => {
  const entityCounts = entitiesList.map((entityName) => {
    const entityInstance = entities[entityName]
    const count = entityInstance.count()
    return { entity: entityName, count }
  })

  render(res, 'index', { entities: entityCounts })
})

/**
 * Route: Get items for an entity (with pagination)
 * Displays a list of IDs or names for the selected entity.
 */
app.get('/ids', (req, res) => {
  const entityName = req.query.entity
  const page = parseInt(req.query.page, 10) || 1
  const perPage = 10
  const offset = (page - 1) * perPage

  if (!entities[entityName]) {
    return res.status(404).send('Entity not found')
  }

  const entityInstance = entities[entityName]
  const ids = entityInstance.getAll(perPage, offset)
  const totalCount = entityInstance.count()
  const totalPages = Math.ceil(totalCount / perPage)

  render(res, 'index', {
    selectedEntity: entityName,
    ids,
    page,
    totalPages
  })
})

/**
 * Route: Get document content
 * Displays the content of the selected document.
 */
app.get('/document', (req, res) => {
  const entityName = req.query.entity
  const id = req.query.id
  const page = parseInt(req.query.page, 10) || 1

  if (!entities[entityName]) {
    return res.status(404).send('Entity not found')
  }

  const entityInstance = entities[entityName]
  const doc = entityInstance.get(id)

  if (!doc) {
    return res.status(404).send('Document not found')
  }

  const documentContent = JSON.stringify(doc.content, null, 2)
  const perPage = 10
  const offset = (page - 1) * perPage
  const ids = entityInstance.getAll(perPage, offset)
  const totalCount = entityInstance.count()
  const totalPages = Math.ceil(totalCount / perPage)

  render(res, 'index', {
    selectedEntity: entityName,
    ids,
    page,
    totalPages,
    selectedItem: id,
    documentContent,
    isVersioned: entityInstance instanceof VersionEntity
  })
})

// Start the server
app.listen(port, () => {
  const url = `http://localhost:${port}`
  console.log(`Server is running at ${url}`)
  // Open the default browser
  open(url)
})
