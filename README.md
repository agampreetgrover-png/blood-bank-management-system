# Blood Bank Management System

DBMS lab mini project. It's a web app for a blood bank: staff can manage donors, patients,
donations, blood requests and issues, and there's a small public site where people can
check stock, register to donate, request blood and track their request.

Stack: React + Vite on the frontend, Node/Express for the API, MySQL for the database.
Login uses JWT and passwords are hashed with bcrypt. Icons are from [Phosphor Icons](https://phosphoricons.com)
by Helena Zhang and Tobias Fried (MIT licence).

## Database

Database name is `blood_bank_db`. There are 9 tables:

- `blood_groups` - the 8 blood groups (A+, A-, B+, B-, AB+, AB-, O+, O-). Other tables point to this.
- `admins` - staff accounts
- `users` - public site accounts (sign up / log in). `donors.user_id` and `blood_requests.user_id` link records to the account that made them.
- `donors` - donor details, last donation date, eligibility. Age has to be 18-65.
- `patients` - patients who need blood (hospital, doctor etc.)
- `inventory` - one row per blood group with the number of units available
- `donations` - every donation. Adding one increases the inventory.
- `blood_requests` - requests for a patient, with urgency (Normal/Urgent/Critical) and status (Pending/Approved/Fulfilled/Rejected)
- `blood_issues` - blood actually given out against a request. This reduces the inventory.

Full schema is in `database/schema.sql` and sample data in `database/seed.sql`.

### ER diagram

```mermaid
erDiagram
    BLOOD_GROUPS ||--o{ DONORS : "categorizes"
    BLOOD_GROUPS ||--o{ PATIENTS : "requires"
    BLOOD_GROUPS ||--|| INVENTORY : "maintains_stock"
    BLOOD_GROUPS ||--o{ DONATIONS : "collected_type"
    BLOOD_GROUPS ||--o{ BLOOD_REQUESTS : "requested_type"
    BLOOD_GROUPS ||--o{ BLOOD_ISSUES : "dispensed_type"

    ADMINS ||--o{ DONATIONS : "recorded_by"
    ADMINS ||--o{ BLOOD_REQUESTS : "reviewed_by"
    ADMINS ||--o{ BLOOD_ISSUES : "authorized_by"

    DONORS ||--o{ DONATIONS : "makes"
    PATIENTS ||--o{ BLOOD_REQUESTS : "initiates"
    PATIENTS ||--o{ BLOOD_ISSUES : "receives"
    BLOOD_REQUESTS ||--o| BLOOD_ISSUES : "fulfilled_by"
    USERS ||--o{ DONORS : "owns_profile"
    USERS ||--o{ BLOOD_REQUESTS : "submits"

    BLOOD_GROUPS {
        INT id PK
        VARCHAR group_name UK
        VARCHAR description
        TIMESTAMP created_at
    }

    ADMINS {
        INT id PK
        VARCHAR name
        VARCHAR email UK
        VARCHAR password
        TINYINT is_active
        TIMESTAMP created_at
    }

    USERS {
        INT id PK
        VARCHAR full_name
        VARCHAR email UK
        VARCHAR phone UK
        VARCHAR password
        INT blood_group_id FK
        TINYINT is_active
        TIMESTAMP created_at
    }

    DONORS {
        INT id PK
        VARCHAR full_name
        DATE date_of_birth
        INT age
        ENUM gender
        INT blood_group_id FK
        VARCHAR phone
        VARCHAR email
        TEXT address
        DATE last_donation_date
        TINYINT is_eligible
        TINYINT is_active
        INT user_id FK
        TIMESTAMP created_at
    }

    PATIENTS {
        INT id PK
        VARCHAR full_name
        INT age
        ENUM gender
        INT blood_group_id FK
        VARCHAR hospital
        VARCHAR doctor_name
        VARCHAR phone
        TEXT address
        TINYINT is_active
        TIMESTAMP created_at
    }

    INVENTORY {
        INT id PK
        INT blood_group_id FK,UK
        INT available_units
        TIMESTAMP last_updated
    }

    DONATIONS {
        INT id PK
        INT donor_id FK
        INT blood_group_id FK
        DATE donation_date
        INT units_donated
        ENUM status
        TEXT notes
        INT created_by FK
        TIMESTAMP created_at
    }

    BLOOD_REQUESTS {
        INT id PK
        INT patient_id FK
        INT blood_group_id FK
        INT units_required
        VARCHAR hospital
        DATE request_date
        ENUM urgency
        ENUM status
        TEXT notes
        INT created_by FK
        INT user_id FK
        TIMESTAMP created_at
    }

    BLOOD_ISSUES {
        INT id PK
        INT request_id FK
        INT patient_id FK
        INT blood_group_id FK
        INT units_issued
        DATE issue_date
        TEXT notes
        INT issued_by FK
        TIMESTAMP created_at
    }
```

### Constraints

Some CHECK constraints we added:

- `chk_donor_age` - donor age between 18 and 65
- `chk_units_non_negative` - inventory can't go below 0
- `chk_donation_units` - 1 to 3 units per donation
- `chk_request_units` - 1 to 10 units per request

Foreign keys are used everywhere instead of storing blood group names as text. Donors and
patients are not actually deleted, we just set `is_active = 0` so old donation/issue records
don't break.

### Transactions

Issuing blood (`POST /api/issues`) is done inside a transaction because two staff could try to
issue the same units at the same time:

1. `beginTransaction()`
2. `SELECT available_units FROM inventory WHERE blood_group_id = ? FOR UPDATE` (locks the row)
3. If there aren't enough units -> `rollback()` and return an error like
   "Insufficient O+ blood available. Available: 1 unit(s). Requested: 2 unit(s)."
4. Otherwise insert into `blood_issues`, subtract from `inventory`, mark the request as
   `Fulfilled`, then `commit()`

Recording a donation works the same way (insert donation, add to inventory, update donor's
last donation date, commit).

Stock status shown on the site: 0 units = Critical, 1-2 = Low Stock, 3 or more = Available.

## How to run

You need Node.js (18+) and MySQL 8 running on port 3306.

**1. Set up `.env`**

Copy `server/.env.example` to `server/.env` and put your MySQL password:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=blood_bank_db
DB_PORT=3306
JWT_SECRET=any_random_string
PORT=5000
```

**2. Create the database**

```
cd server
npm install
npm run setup-db
```

or run the SQL files yourself:

```
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

Default admin login: `admin@bloodbank.com` / `admin123`

If you already have the database from before, you don't need to run setup again. The server adds the
`users` table and `user_id` columns by itself on startup (`server/utils/migrate.js`).

**3. Start the backend**

```
cd server
npm start
```

Runs on http://localhost:5000 (check http://localhost:5000/api/health if it's working).

**4. Start the frontend** (in another terminal)

```
cd client
npm install
npm run dev
```

Open http://localhost:5173.

- `/` is the landing page. It's also the login page: pick "Donor or patient" or "Staff".
  `/login` and `/admin/login` open the same page with that option already picked.
- Public site: `/home`, `/availability`, and (after logging in) `/donate`, `/request-blood`, `/track`
- Public accounts: `/signup`, `/account`
- Admin panel: `/admin`, `/admin/donors`, `/admin/donations`, `/admin/patients`,
  `/admin/requests`, `/admin/issues`

From the project root you can also run `npm run dev:server` and `npm run dev:client`.

The helpline number, email and address on the public site can be changed in
`client/src/config/site.js`.

## API

Routes marked * need the admin JWT token. User tokens and admin tokens are separate (`role` in the token),
so a public user can't call admin routes.

Auth
- `POST /api/auth/login`
- `GET /api/auth/profile` *

Public
- `GET /api/public/overview` - counts and stock per group
- `POST /api/public/blood-request` - needs user token. Creates a patient + pending request linked to that account

Users (public accounts)
- `POST /api/users/register`
- `POST /api/users/login` - email or phone + password
- `GET /api/users/me` - needs user token. Returns the profile, own donor profile, donations and requests.
  The Track page uses this, so a user only ever sees records linked to their own account.

Inventory
- `GET /api/inventory`
- `GET /api/inventory/:bloodGroup`
- `PUT /api/inventory/:id` * - manual adjustment

Donors *
- `GET /api/donors`, `GET /api/donors/:id`, `POST /api/donors`, `PUT /api/donors/:id`, `DELETE /api/donors/:id`

Donations *
- `GET /api/donations`, `GET /api/donations/:id`, `POST /api/donations`
- `POST /api/donations/public-signup` - needs a user token, not admin. Books a donation for the logged-in
  user, using the phone number on their account

Patients *
- `GET /api/patients`, `GET /api/patients/:id`, `POST /api/patients`, `PUT /api/patients/:id`, `DELETE /api/patients/:id`

Requests *
- `GET /api/requests`, `POST /api/requests`, `PUT /api/requests/:id`, `DELETE /api/requests/:id`

Issues *
- `GET /api/issues`, `GET /api/issues/:id`, `POST /api/issues`

Dashboard
- `GET /api/dashboard/stats` *
- `GET /api/dashboard/blood-groups`

## Folder structure

```
client/                 React frontend (Vite)
  src/
    components/         AdminLayout, PublicLayout, modals, BloodTag, SearchInput
    config/site.js      helpline, address etc. shown on the public site
    context/            toast notifications
    hooks/              useAuth (staff session), useUserAuth (public accounts)
    pages/
      LandingPage.jsx   landing + login for both users and staff
      public/           home, blood stock, donate, request, track, signup, account
      admin/            dashboard, donors, donations, patients, requests, issues
    services/api.js     axios instance, attaches the right token
    styles/             index.css (shared + admin), public.css (public site)
server/                 Express API
  config/db.js          MySQL connection pool
  controllers/          one file per resource
  middleware/           auth.js (staff), userAuth.js (public users)
  routes/
  scripts/              setupDatabase.js, seedAdmin.js (run with npm scripts)
  utils/migrate.js      small schema updates that run on startup
  server.js
database/               schema.sql, seed.sql
```

## Things we could add later

- SMS to donors when their blood group is running low
- Barcode for each blood bag
- Online appointment booking with time slots

## Team

- Name - Roll no.
- Name - Roll no.
