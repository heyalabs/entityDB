# EntityDB

EntityDB is a lightweight, hybrid database management package designed to combine the advantages of SQL indexing and schema-less JSON storage. It leverages SQLite for its efficient file-based database capabilities and is particularly well-suited for AI-driven applications, where rapid data retrieval and flexible content structures are key.

## Features

### Entity Class

The `Entity` class provides a robust interface for managing schema-less entities:

- **Hybrid Storage:** Metadata is stored in SQL tables for efficient indexing and relationships, while content is stored as JSON for flexibility.
- **CRUD Operations:** Create, retrieve, update, and delete entities with minimal setup.
- **Relationship Modeling:** Define foreign key relationships between entities, enabling structured queries and linking.
- **Efficient Queries:** SQL indexes on metadata fields like `id`, `type`, `createdAt`, and foreign keys enable fast lookups.

### VersionEntity Class

The `VersionEntity` class extends `Entity` to add support for versioned entities:

- **Version Control:** Track changes over time with automatic versioning.
- **Controlled Access:** Protect versioned entities from direct user manipulation, ensuring safe and reliable version tracking.
- **Optimized for AI:** Manage configurations, settings, or documents where historical context and reproducibility are critical.

## Why EntityDB?

### Motivation

Traditional database solutions often fall short when combining performance, flexibility, and AI readiness:

- **MySQL Databases:** Excellent for relational queries but can be slow for complex operations at scale.
- **Document-Based Databases:** Great for schema-less data but lack robust relationship modeling and querying capabilities.

EntityDB bridges these gaps:

- **SQL for Metadata:** Efficient indexing and relationships.
- **JSON for Content:** Flexible, schema-less storage.
- **Optimized for AI:** Quickly retrieve documents and leverage AI for deep query answering, bypassing complex SQL query requirements.

### Benefits

- **Portability:** SQLite's file-based nature makes the database easy to deploy, share, and manage.
- **Performance:** SQL indexing ensures fast lookups, while JSON content allows for unstructured data storage.
- **Scalable Design:** Adapts to a wide range of use cases, from simple entity storage to complex, versioned data management.

## Use Cases

- **AI-Driven Applications:** Efficiently retrieve data for AI analysis, enabling deep insights without complex query construction.
- **Configuration Management:** Track changes over time with versioning for reproducibility and historical context.
- **Messaging Systems:** Model relationships between entities (e.g., messages linked to conversations) for organized data management.

## Getting Started

### Installation

To install EntityDB, use your package manager of choice:

```bash
npm install entity-db
```

### Basic Usage

#### Initialize the Database

```javascript
import Database from 'better-sqlite3'
import { Entity, VersionEntity } from 'entity-db'

const db = new Database('example.db')
```

#### Create an Entity

```javascript
const userEntity = new Entity(db, 'User', ['groupId'])
userEntity.insert(
  { name: 'Alice', email: 'alice@example.com' },
  { groupId: 'group1' }
)
```

#### Retrieve an Entity

```javascript
const user = userEntity.get('some-uuid')
console.log(user)
```

#### Manage Versioned Entities

```javascript
const configEntity = new VersionEntity(db, 'Config')
configEntity.insert('app-settings', { theme: 'dark', language: 'en' })
const latestConfig = configEntity.get('app-settings')
console.log(latestConfig)
```

## Contributions

Contributions are welcome! Feel free to open issues or submit pull requests to improve EntityDB.

## License

EntityDB is licensed under the MIT License.
