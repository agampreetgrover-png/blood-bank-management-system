# Blood Bank Management System

DBMS lab mini project. It's a web app for a blood bank: staff can manage donors, patients,
donations, blood requests and issues, and there's a small public site where people can
check stock, register to donate, request blood and track their request.

Stack: React + Vite on the frontend, Node/Express for the API, MySQL for the database.
Login uses JWT and passwords are hashed with bcrypt. Public accounts use two-factor login: a password plus a
6-digit code from an authenticator app (Google Authenticator or Microsoft Authenticator). You scan a QR code when
you sign up, and a forgotten password is reset with a code from the app. If the phone is lost, a backup code works
instead, or staff can reset the authenticator from the admin panel. The app sends no emails at all.
Icons are from [Phosphor Icons](https://phosphoricons.com) by Helena Zhang and Tobias Fried (MIT licence).

## Database

Database name is `blood_bank_db`. There are 10 tables:

- `blood_groups` - the 8 blood groups (A+, A-, B+, B-, AB+, AB-, O+, O-). Other tables point to this.
- `admins` - staff accounts
- `users` - public site accounts (sign up / log in). `donors.user_id` and `blood_requests.user_id` link records to the account that made them.
  `totp_secret` is the authenticator app secret (stored encrypted, NULL until it's set up), `totp_last_step` stops the
  same code being used twice, and `mfa_failures` / `mfa_locked_until` lock code entry for 15 minutes after 5 wrong codes.
  `token_version` goes up on a password or authenticator reset, which signs out old sessions.
- `user_backup_codes` - 8 one-time backup codes per user, for when they lose their phone. Only a keyed hash of each
  code is stored, and `used_at` is set once a code has been used. Rows are deleted with the user.
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
    USERS ||--o{ USER_BACKUP_CODES : "has"

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
        INT token_version
        VARCHAR totp_secret
        BIGINT totp_last_step
        TINYINT mfa_failures
        DATETIME mfa_locked_until
        TIMESTAMP created_at
    }

    USER_BACKUP_CODES {
        INT id PK
        INT user_id FK
        CHAR code_hash
        DATETIME used_at
        DATETIME created_at
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

`MFA_SECRET` is optional. It encrypts the authenticator secrets saved in the database, and if it's empty
`JWT_SECRET` is used. Don't change it (or `JWT_SECRET`, if you didn't set one) once people have set up their
authenticator, because their saved secrets can't be read any more and staff would have to reset every account.

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

If you already have the database from before, you don't need to run setup again. On startup the server adds the
`users` table, `user_id` columns, the new `users` columns (`token_version`, `totp_secret`, `totp_last_step`,
`mfa_failures`, `mfa_locked_until`) and the `user_backup_codes` table, and drops the old `otp_codes` table
(`server/utils/migrate.js`). Existing accounts set up their authenticator app at their next login.

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

- `/` is the landing page. It's also the login page for public accounts (`/login` opens the same page).
  Staff use the "Admin login" link under the form, or go to `/admin/login`.
- Public site: `/home`, `/availability`, and (after logging in) `/donate`, `/request-blood`, `/track`
- Public accounts: `/signup`, `/account`, `/reset-password` (forgot or change password)
- Admin panel: `/admin`, `/admin/donors`, `/admin/donations`, `/admin/patients`,
  `/admin/requests`, `/admin/issues`, `/admin/accounts`

From the project root you can also run `npm run dev:server` and `npm run dev:client`.

The helpline number, email and address on the public site can be changed in
`client/src/config/site.js`.

## Two-factor login

**For users**

1. Install **Google Authenticator** or **Microsoft Authenticator** on your phone.
2. When you sign up, the site shows a QR code. In the app tap **+**, scan it, and type the 6-digit code the app shows.
   If you can't scan, type the key shown under the QR code into the app instead.
   Accounts made before this change are asked to do the same thing after their password at their next login.
3. You then get 8 backup codes (like `ABCD-EFGH`). Save them somewhere safe, you only see them once. Each one works once.
4. After that, every login is your password plus the current code from the app.

Lost your phone? Type a backup code instead of the app code (on the login page or the forgot password page).
You can get a fresh set of backup codes from the Account page. If you have no backup codes left, ask the blood bank staff
to reset your authenticator, then set it up again at your next login.

5 wrong codes in a row block code entry for 15 minutes.

**For staff**

If a user has lost their phone and their backup codes, go to **Admin panel -> Accounts**, find the user and click
**Reset authenticator**. This removes their authenticator and backup codes and signs them out. At their next login they
enter their password and scan a new QR code. Staff (admin) login itself is still email + password only.

## API

Routes marked * need the admin JWT token. User tokens and admin tokens are separate (`role` in the token),
so a public user can't call admin routes. Admin tokens last 24 hours, user tokens 7 days.

Every request with a token also checks the account in the database, so a session ends straight away (401)
when the account is deactivated or, for public accounts, when the password is reset. The frontend then
clears that session and sends the person back to the right login page.

Passwords need at least 8 characters. Password logins allow 20 failed attempts per IP every 15 minutes.

Auth
- `POST /api/auth/login` - `{ email, password }`
- `GET /api/auth/me` *

Public
- `GET /api/public/overview` - counts and stock per group
- `POST /api/public/blood-request` - needs user token. Creates a patient + pending request linked to that account

Users (public accounts)
- `POST /api/users/signup` - `{ full_name, email, phone, password, blood_group_id }`. Checks the details and returns
  a `setup_token` plus the QR code / key to scan. Nothing is saved yet.
- `POST /api/users/signup/verify` - `{ setup_token, code }`. Checks the app code, creates the account and returns the
  user token and the 8 backup codes. The setup token lasts 10 minutes.
- `POST /api/users/login` - `{ identifier, password }`, identifier is email or phone. Step 1 of 2: a correct password
  doesn't return a session token, it returns `{ stage: 'verify', mfa_token }`, or `{ stage: 'setup', mfa_token, setup }`
  with a QR code if the account has no authenticator yet. The `mfa_token` lasts 5 minutes.
- `POST /api/users/login/verify` - `{ mfa_token, code }`. Step 2 of 2: the app code (or a backup code) returns the user
  token. For the setup stage it also saves the authenticator and returns the backup codes.
- `POST /api/users/password/reset` - `{ identifier, code, password }`. Needs an app code or backup code. Sets the new
  password, signs out every other session for the account and returns a new user token.
- `POST /api/users/mfa/backup-codes` - needs user token, `{ code }` (current app code). Replaces the backup codes and returns the new ones.
- `GET /api/users/me` - needs user token. Returns the profile, own donor profile, donations, requests and
  `backup_codes_left`. The Track page uses this, so a user only ever sees records linked to their own account.

App codes are 6 digits and change every 30 seconds, and each one can only be used once. 5 wrong codes in a row lock
code entry for 15 minutes.

Accounts *
- `GET /api/accounts?search=` - public accounts, with whether they have an authenticator and how many backup codes are left
- `POST /api/accounts/:id/reset-authenticator` - removes the user's authenticator and backup codes and signs them out

Inventory
- `GET /api/inventory`
- `GET /api/inventory/:bloodGroup`

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
- `PUT` can set the status to Pending, Approved or Rejected. A request only becomes Fulfilled when blood is
  issued for it (`POST /api/issues`), and a fulfilled request can't be changed or issued again.

Issues *
- `GET /api/issues`, `GET /api/issues/:id`, `POST /api/issues`

Dashboard
- `GET /api/dashboard/stats` *
- `GET /api/dashboard/blood-groups`

## Folder structure

```
client/                 React frontend (Vite)
  src/
    components/         AdminLayout, PublicLayout, modals, BloodTag, SearchInput,
                        ProtectedRoute (admin pages) and RequireUser (account-only public pages),
                        AuthenticatorSetup, CodeStep, BackupCodes (two-factor login screens)
    config/site.js      helpline, address etc. shown on the public site
    context/            toast notifications
    hooks/              useAuth (staff session), useUserAuth (public accounts)
    pages/
      LandingPage.jsx   landing + login for both users and staff
      ResetPasswordPage.jsx  forgot / change password for public accounts
      public/           home, blood stock, donate, request, track, signup, account
      admin/            dashboard, donors, donations, patients, requests, issues, accounts
    services/api.js     axios instance, attaches the right token and ends a session on 401
    services/session.js saved logins (localStorage), drops expired ones, syncs across tabs
    utils/dates.js      today's date in the user's time zone, for date inputs
    styles/             index.css (shared + admin), public.css (public site)
server/                 Express API
  config/db.js          MySQL connection pool
  controllers/          one file per resource
  middleware/           auth.js (staff), userAuth.js (public users), rateLimit.js
  routes/
  scripts/              setupDatabase.js, seedAdmin.js (run with npm scripts)
  utils/migrate.js      small schema updates that run on startup
  utils/tokens.js       signs / reads login tokens
  utils/passwords.js    password rules, hashing and checking
  utils/totp.js         authenticator secrets (encrypted), QR codes, code checks, backup codes, lockout
  utils/dates.js        local calendar dates (YYYY-MM-DD) and date checks
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
