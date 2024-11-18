// entityDB.js

import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

/**
 * EntityDB
 *
 * Provides classes for managing entities and versioned entities in a SQLite database.
 * - Each entity type corresponds to a table.
 * - Supports schema-less JSON content with indexed relationships.
 */

export class Entity {
  /**
   * Constructs an Entity instance.
   * @param {Database} db - SQLite database connection.
   * @param {string} entityType - Type of the entity (e.g., 'User', 'Config').
   * @param {Array<string>} foreignKeys - List of foreign keys for relationships.
   */
  constructor(db, entityType, foreignKeys = []) {
    this.db = db
    this.entityType = entityType
    this.foreignKeys = foreignKeys
    this._init()
  }

  /**
   * Generates the table name based on the entity type.
   * @returns {string} The table name for the entity.
   */
  getTableName() {
    return `entity_${this.entityType}`
  }

  /**
   * Initializes the entity's table and indexes in the SQLite database.
   * @private
   */
  _init() {
    const tableName = this.getTableName()
    // Build the CREATE TABLE statement
    let createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      type TEXT,
      createdAt TEXT,`

    // Add foreign key columns
    for (const key of this.foreignKeys) {
      createTableSQL += `${key} TEXT,`
    }

    // Add content field
    createTableSQL += `content TEXT)`

    // Execute the CREATE TABLE statement
    this.db.prepare(createTableSQL).run()

    // Create indexes on foreign keys and type
    const fieldsToIndex = ['type', ...this.foreignKeys]
    for (const field of fieldsToIndex) {
      const indexName = `${tableName}_${field}_idx`
      this.db
        .prepare(
          `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${field})`
        )
        .run()
    }
  }

  /**
   * Validates the presence of required foreign keys in the data.
   * @param {Object} data - Data to be validated.
   * @throws Will throw an error if any expected foreign key is missing.
   * @private
   */
  _validateForeignKeys(data) {
    for (const key of this.foreignKeys) {
      if (!(key in data)) {
        throw new Error(`Missing foreign key: ${key}`)
      }
    }
  }

  /**
   * Inserts a new document without versioning.
   * @param {Object} content - The main content of the entity.
   * @param {Object} foreignKeys - Foreign keys related to the entity.
   * @returns {Object} The inserted document data.
   */
  insert(content, foreignKeys = {}) {
    if (!content) {
      throw new Error('Content is required')
    }
    this._validateForeignKeys(foreignKeys)

    const id = uuidv4()
    const type = this.entityType
    const createdAt = new Date().toISOString()
    const tableName = this.getTableName()

    // Build the insert statement
    const columns = ['id', 'type', 'createdAt', 'content']
    const placeholders = columns.map(() => '?')
    const values = [id, type, createdAt, JSON.stringify(content)]

    // Add foreign key columns and values
    for (const key of this.foreignKeys) {
      columns.push(key)
      placeholders.push('?')
      values.push(foreignKeys[key])
    }

    const sql = `INSERT INTO ${tableName} (${columns.join(
      ', '
    )}) VALUES (${placeholders.join(', ')})`

    this.db.prepare(sql).run(values)

    return { id, type, createdAt, ...foreignKeys, content }
  }

  /**
   * Retrieves a document by its ID.
   * @param {string} id - The ID of the document to retrieve.
   * @returns {Object|null} The document if found, otherwise null.
   */
  get(id) {
    const tableName = this.getTableName()
    const sql = `SELECT * FROM ${tableName} WHERE id = ?`
    const row = this.db.prepare(sql).get(id)
    if (row) {
      row.content = JSON.parse(row.content)
      return row
    } else {
      return null
    }
  }

  /**
   * Retrieves the total count of documents in the entity's table.
   * @returns {number} The total count of documents.
   */
  count() {
    const tableName = this.getTableName()
    const sql = `SELECT COUNT(*) AS count FROM ${tableName}`
    const row = this.db.prepare(sql).get()
    return row.count
  }

  /**
   * Retrieves a list of document IDs with pagination.
   * @param {number} limit - The maximum number of IDs to retrieve.
   * @param {number} offset - The number of IDs to skip.
   * @returns {Array<string>} An array of document IDs.
   */
  getAll(limit = 10, offset = 0) {
    const tableName = this.getTableName()
    const sql = `SELECT id FROM ${tableName} LIMIT ? OFFSET ?`
    const rows = this.db.prepare(sql).all(limit, offset)
    return rows.map((row) => row.id)
  }

  /**
   * Deletes a document by its ID.
   * @param {string} id - The ID of the document to delete.
   * @returns {Object} The result of the deletion operation.
   */
  delete(id) {
    const tableName = this.getTableName()
    const sql = `DELETE FROM ${tableName} WHERE id = ?`
    const result = this.db.prepare(sql).run(id)
    return result
  }
}

export class VersionEntity extends Entity {
  /**
   * Constructs a VersionEntity instance.
   * @param {Database} db - SQLite database connection.
   * @param {string} entityType - Type of the entity (e.g., 'Config').
   * @param {Array<string>} foreignKeys - List of foreign keys for relationships.
   * @param {number} [maxRetries=5] - Maximum number of retries for conflict handling.
   */
  constructor(db, entityType, foreignKeys = [], maxRetries = 5) {
    super(db, entityType, foreignKeys)
    this.maxRetries = maxRetries
  }

  /**
   * Initializes the entity's table and indexes in the SQLite database, including versioning fields.
   * @private
   */
  _init() {
    const tableName = this.getTableName()
    // Build the CREATE TABLE statement
    let createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      type TEXT,
      name TEXT,
      version INTEGER,
      createdAt TEXT,`

    // Add foreign key columns
    for (const key of this.foreignKeys) {
      createTableSQL += `${key} TEXT,`
    }

    // Add content field
    createTableSQL += `content TEXT)`

    // Execute the CREATE TABLE statement
    this.db.prepare(createTableSQL).run()

    // Create indexes on 'name', 'version', foreign keys, and type
    const fieldsToIndex = ['type', 'name', 'version', ...this.foreignKeys]
    for (const field of fieldsToIndex) {
      const indexName = `${tableName}_${field}_idx`
      this.db
        .prepare(
          `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${field})`
        )
        .run()
    }
  }

  /**
   * Inserts a new versioned document. Each call increments the version number.
   * @param {string} name - Unique name for identifying versions of the entity (required).
   * @param {Object} content - The main content of the versioned entity.
   * @param {Object} foreignKeys - Foreign keys related to the entity.
   * @param {number} [retryCount=0] - Current retry count for conflict handling.
   * @returns {Object} The inserted document data.
   */
  insert(name, content, foreignKeys = {}, retryCount = 0) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error(
        'Name must be a non-empty string and is required in VersionEntity.'
      )
    }
    if (!content) {
      throw new Error('Content is required')
    }
    this._validateForeignKeys(foreignKeys)

    const insertOperation = this.db.transaction(() => {
      const tableName = this.getTableName()
      // Get the latest version number
      const sql = `SELECT MAX(version) as maxVersion FROM ${tableName} WHERE name = ?`
      const row = this.db.prepare(sql).get(name)
      const latestVersion = row && row.maxVersion ? row.maxVersion : 0
      const nextVersion = latestVersion + 1

      const id = `${this.entityType}_${name}_${nextVersion}`
      const type = this.entityType
      const createdAt = new Date().toISOString()

      // Build the insert statement
      const columns = ['id', 'type', 'name', 'version', 'createdAt', 'content']
      const placeholders = columns.map(() => '?')
      const values = [
        id,
        type,
        name,
        nextVersion,
        createdAt,
        JSON.stringify(content)
      ]

      // Add foreign key columns and values
      for (const key of this.foreignKeys) {
        columns.push(key)
        placeholders.push('?')
        values.push(foreignKeys[key])
      }

      const insertSql = `INSERT INTO ${tableName} (${columns.join(
        ', '
      )}) VALUES (${placeholders.join(', ')})`

      this.db.prepare(insertSql).run(values)

      return {
        id,
        type,
        name,
        version: nextVersion,
        createdAt,
        ...foreignKeys,
        content
      }
    })

    try {
      return insertOperation()
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.warn(`Error occurred. Retrying insert...`)
        return this.insert(name, content, foreignKeys, retryCount + 1)
      }
      throw error
    }
  }

  /**
   * Overrides insert without name to prevent accidental use.
   * Disabled in VersionEntity.
   */
  insert(content, foreignKeys = {}) {
    throw new Error('Use insert(name, content, foreignKeys) in VersionEntity.')
  }

  /**
   * Retrieves the latest version of a document by its name.
   * @param {string} name - Unique name identifying the entity.
   * @returns {Object|null} The latest document version if found, otherwise null.
   */
  get(name) {
    const tableName = this.getTableName()
    const sql = `SELECT * FROM ${tableName} WHERE name = ? ORDER BY version DESC LIMIT 1`
    const row = this.db.prepare(sql).get(name)
    if (row) {
      row.content = JSON.parse(row.content)
      return row
    } else {
      return null
    }
  }

  /**
   * Retrieves the total count of unique names in the entity's table.
   * @returns {number} The total count of unique names.
   */
  count() {
    const tableName = this.getTableName()
    const sql = `SELECT COUNT(DISTINCT name) AS count FROM ${tableName}`
    const row = this.db.prepare(sql).get()
    return row.count
  }

  /**
   * Retrieves a list of unique names with pagination.
   * @param {number} limit - The maximum number of names to retrieve.
   * @param {number} offset - The number of names to skip.
   * @returns {Array<string>} An array of unique names.
   */
  getAll(limit = 10, offset = 0) {
    const tableName = this.getTableName()
    const sql = `SELECT DISTINCT name FROM ${tableName} LIMIT ? OFFSET ?`
    const rows = this.db.prepare(sql).all(limit, offset)
    return rows.map((row) => row.name)
  }

  /**
   * Retrieves all versions of a document by its name.
   * @param {string} name - Unique name identifying the entity.
   * @param {number} [limit=10] - Maximum number of results to return.
   * @param {number} [offset=0] - Number of results to skip (for pagination).
   * @returns {Array<Object>} An array of all document versions.
   */
  getVersions(name, limit = 10, offset = 0) {
    const tableName = this.getTableName()
    const sql = `SELECT * FROM ${tableName} WHERE name = ? ORDER BY version DESC LIMIT ? OFFSET ?`
    const rows = this.db.prepare(sql).all(name, limit, offset)
    return rows.map((row) => {
      row.content = JSON.parse(row.content)
      return row
    })
  }

  /**
   * Retrieves a specific version of a document by name and version.
   * @param {string} name - Unique name identifying the entity.
   * @param {number} version - Specific version number to retrieve.
   * @returns {Object|null} The document for the specified version, if found.
   */
  getVersion(name, version) {
    const tableName = this.getTableName()
    const sql = `SELECT * FROM ${tableName} WHERE name = ? AND version = ? LIMIT 1`
    const row = this.db.prepare(sql).get(name, version)
    if (row) {
      row.content = JSON.parse(row.content)
      return row
    } else {
      return null
    }
  }

  /**
   * Deletes all versions of a document by its name.
   * @param {string} name - Unique name identifying the entity.
   * @returns {Object} The result of the deletion operation.
   */
  deleteAllVersions(name) {
    const tableName = this.getTableName()
    const sqlDelete = `DELETE FROM ${tableName} WHERE name = ?`
    const result = this.db.prepare(sqlDelete).run(name)
    return result
  }

  /**
   * Deletes a specific version of a document by name and version.
   * @param {string} name - Unique name identifying the entity.
   * @param {number} version - Specific version number to delete.
   * @returns {Object} The result of the deletion operation.
   */
  deleteVersion(name, version) {
    const tableName = this.getTableName()
    const sqlDelete = `DELETE FROM ${tableName} WHERE name = ? AND version = ?`
    const result = this.db.prepare(sqlDelete).run(name, version)
    return result
  }

  /**
   * Deletes the latest version of a document by its name.
   * @param {string} name - Unique name identifying the entity.
   * @returns {Object|null} The deleted document data if found, otherwise null.
   */
  delete(name) {
    const tableName = this.getTableName()
    const sqlGet = `SELECT * FROM ${tableName} WHERE name = ? ORDER BY version DESC LIMIT 1`
    const row = this.db.prepare(sqlGet).get(name)
    if (row) {
      const sqlDelete = `DELETE FROM ${tableName} WHERE id = ?`
      this.db.prepare(sqlDelete).run(row.id)
      return row
    } else {
      return null
    }
  }
}
