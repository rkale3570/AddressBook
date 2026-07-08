# Business Card Scanner & Smart Contact Manager

Full-stack MVP for scanning business cards, voice-based contact entry, duplicate detection, and relationship management.

## Tech Stack

- **Backend:** NestJS, PostgreSQL, Drizzle ORM
- **Frontend:** React, TypeScript, Vite

## Project Structure

```
AddressBook/
├── backend/          # NestJS API server
│   ├── src/
│   │   ├── common/           # DTOs, shared types
│   │   ├── config/           # App configuration
│   │   ├── database/         # Drizzle schema, DB module
│   │   ├── contacts/         # Contact CRUD module
│   │   ├── scan/             # Business card OCR module
│   │   ├── voice/            # Voice transcription parser
│   │   ├── duplicates/       # Duplicate detection
│   │   └── relationships/    # Contact groups & relationships
│   ├── drizzle.config.ts
│   └── .env
├── frontend/         # React SPA
│   ├── src/
│   │   ├── api/              # API client
│   │   ├── components/       # Shared components
│   │   ├── pages/            # Route pages
│   │   └── types/            # TypeScript interfaces
│   └── vite.config.ts
└── README.md
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## Environment Variables (backend/.env)

```
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/addressbook
CORS_ORIGINS=http://localhost:5173
```

## Database Setup

1. Create a PostgreSQL database:
   ```bash
   createdb addressbook
   ```

2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Generate and apply migrations:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

   Alternatively, use drizzle-kit commands directly:
   ```bash
   npx drizzle-kit generate:pg
   npx drizzle-kit push:pg
   ```

## Running the Backend

```bash
cd backend
npm run start:dev
```

The API will be available at `http://localhost:3001/api`.

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

## API Endpoints

### Contacts
- `GET /api/contacts` - List contacts (query: page, limit, search)
- `GET /api/contacts/:id` - Get contact details
- `POST /api/contacts` - Create contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

### Business Card Scan
- `POST /api/scan/image` - Upload image for OCR (multipart/form-data)
- `POST /api/scan/text` - Parse text directly

### Voice Entry
- `POST /api/voice/transcribe` - Parse natural language transcript

### Duplicate Detection
- `POST /api/duplicates/check` - Check for duplicate contacts
- `POST /api/duplicates/resolve` - Resolve duplicates

### Relationships
- `POST /api/relationships` - Create relationship between contacts
- `GET /api/relationships/contact/:id` - Get contact's relationships
- `DELETE /api/relationships/:id` - Remove relationship
- `POST /api/relationships/groups` - Create a group
- `GET /api/relationships/groups` - List groups
- `POST /api/relationships/groups/:id/contacts` - Add contacts to group
- `DELETE /api/relationships/groups/:id` - Delete group

## Database Schema

### contacts
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| full_name | text | Contact's full name |
| job_title | text (nullable) | Job title |
| company | text (nullable) | Company name |
| website | text (nullable) | Website URL |
| address | text (nullable) | Physical address |
| business_relationship | text (nullable) | Client, Vendor, etc. |
| notes | text (nullable) | Free-form notes |
| created_at | timestamp | Auto-generated |
| updated_at | timestamp | Auto-generated |

### contact_emails
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| contact_id | uuid | FK to contacts |
| email | text | Email address (unique index) |
| type | text | work, personal, other |

### contact_phones
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| contact_id | uuid | FK to contacts |
| phone | text | Phone number (unique index) |
| type | text | mobile, office, home, other |

### relationships
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| contact_id_1 | uuid | FK to contacts |
| contact_id_2 | uuid | FK to contacts |
| relationship_type | text | Spouse, Partner, etc. |
| created_at | timestamp | Auto-generated |

### relationship_groups
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Group name |
| created_at | timestamp | Auto-generated |

### contact_groups
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| contact_id | uuid | FK to contacts |
| group_id | uuid | FK to relationship_groups |

## Features

### Business Card Scanner
- Upload an image or capture from webcam
- Tesseract.js OCR extracts text from the image
- Parsed fields (name, title, company, email, phone, website, address, relationship)
- Editable results before saving

### Voice Contact Entry
- Browser speech recognition captures spoken words
- Natural language parsing extracts structured fields
- Manual transcript entry as fallback

### Duplicate Detection
- Checks existing contacts by email, phone, and name similarity
- Presents options: Use Existing, Merge, or Create New Anyway

### Relationship Groups
- Link contacts with typed relationships (Spouse, Business Partner, etc.)
- Create named groups with multiple members
- View relationships on contact edit page

## Assumptions

- Tesseract.js runs client-side via the backend for OCR processing
- Speech Recognition uses the Web Speech API (Chrome/Edge recommended)
- PostgreSQL is configured with default port 5432
- Duplicate matching uses fuzzy name matching, exact email/phone matching
- Business OCR parsing uses regex-based extraction (not ML-based NER)
- Image uploads are limited to 10MB
