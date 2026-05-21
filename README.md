# EventIQ Backend

A RESTful event management and ticket booking backend built with Express.js and MongoDB.

Features include:

- User authentication (JWT)
- Event creation and management
- Ticket types and inventory
- Ticket booking and QR-based verification/check-in
- Payment simulation flow
- Organizer dashboard statistics
- Email notifications (Nodemailer)
- Only verified users can create or book events (email verification required)

## Quick start

1. Copy `.env.example` to `.env` and fill values (see Environment variables).
2. Install dependencies:

```bash
npm install
```

3. Start server:

```bash
npm run start
# or for development with nodemon
npm run dev
```

Server defaults to `http://localhost:5000` (or `PORT` from `.env`).

## Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- JSON Web Tokens (JWT)
- Cloudinary (image hosting)
- Nodemailer (email)
- Multer (multipart/form-data uploads)

## Environment variables

Required:

- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — JWT signing secret
- `mailUser` and `mailPass` — Gmail credentials used to send emails
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — Cloudinary credentials
- `PORT` — optional server port

## Folder Structure

```
├── config/
├── controllers/
├── middlewares/
├── models/
├── routes/
├── services/
├── utils/
├── index.js
└── package.json
```

## Routes / Endpoints

Base URL: `/api`

All endpoints that require authentication expect a JWT in the `Authorization` header as `Bearer <token>`.

**Users** (`/api/users`)

- POST `/register` — Register a new user
    - Body: `{ firstName, lastName, email, password, confirmPassword, terms }`
    - Returns: created user info and message
- POST `/login` — Sign in
    - Body: `{ email, password }`
    - Returns: `{ token, user }` on success
- GET `/dashboard` — Get current user's profile (auth required)
    - Header: `Authorization: Bearer <token>`
- PATCH `/update-user` — Update profile (auth required)
    - Form-data, optional `profilePic` file and fields: `firstName, lastName, email, phoneNumber, bio, location`
- POST `/verify-email` — Verify user email
- POST `/send-otp-email` — Send OTP to email
    - Body: `{ email }`
- POST `/forgot-password` — Request password reset
    - Body: `{ email }`
- POST `/reset-password/:token` — Reset password using token
    - Params: `:token`
    - Body: `{ password, confirmPassword }`

**Events** (`/api/events`)

- POST `/create-event` — Create an event (auth + multipart form with `banner` file)
    - Headers: `Authorization: Bearer <token>`
    - FormData fields: `title, description, category, startDate, endDate, startTime, endTime, venue, address, city, state, country, isFree, ticketTypes (stringified JSON), timeZone` and `banner` file
- GET `/get-events` — Get paginated list of events
    - Query: `page`, `limit`
- GET `/get-events/:eventId` — Get event by ID
- GET `/user/:userId/events` — Get events created by a specific user (public)
    - Query: `page`, `limit`
- GET `/get-events-by-user` — Get events for authenticated user (auth required)
- GET `/dashboard-stats` — Organizer dashboard stats (auth required)
- PATCH `/update-event/:eventId` — Update event (auth + optional `banner` file)
    - Params: `:eventId`
- DELETE `/delete-event/:eventId` — Delete event (auth required)
- GET `/total-events` — Get total events count

**Payments** (`/api/payments`)

- POST `/initialize-payment` — Create a pending payment and return a reference (auth required)
    - Headers: `Authorization: Bearer <token>`
    - Body or query: `eventId` (or `event`), `ticketTypeName` (or `ticketType`), `quantity`
    - Returns: `{ reference, paymentId, quantity }`

**Bookings** (`/api/bookings`) — all routes under this prefix use authentication middleware

- GET `/my-bookings` — Get bookings for current user (auth required)
- GET `/debug/my-bookings` — Debug listing (auth required)
- GET `/my-event-bookings` — Get bookings for events created by current user (auth required)
- POST `/payment/success` — Simulate payment callback and create bookings from a payment reference
    - Body or query: `{ reference }` — finds Payment by `reference`, marks it success, creates bookings, sends emails
- POST `/verify-qr` — Verify ticket by QR/ticket code (auth required)
    - Body: `{ ticketCode }` — returns booking info if valid and requester is event organizer
- POST `/check-in/:ticketCode` — Mark a ticket as checked-in (auth; organizer only)
    - Params: `:ticketCode`
- GET `/dashboard-stats` — Per-user bookings dashboard stats (auth required)

**Availability** (`/api/available`)

- GET `/check-availability` — Check ticket availability for an event
    - Query or body: `eventId` (or `event`) and `ticketTypeName` (or `ticketType`)
    - Returns: `{ available: boolean, remaining: number }`

## Ticket Verification System

Each successful booking generates a unique `ticketCode` (and QR code on the client side).

Organizers can:

- Verify tickets via `/api/bookings/verify-qr` (must be event organizer)
- Check attendees in via `/api/bookings/check-in/:ticketCode` (prevents duplicate check-ins)

Note: in this project, an "organizer" is simply a verified user who created an event. Only users who have verified their email can create events or perform booking actions.

This enables quick on-site scanning, validation, and attendee management.

## Example Request

### Login

POST `/api/users/login`

Request body:

```json
{
    "email": "john@example.com",
    "password": "password123"
}
```

Response (success):

```json
{
    "message": "Login successful",
    "token": "<jwt-token>",
    "user": { "id": "...", "firstName": "John", "email": "john@example.com" }
}
```

## Security Features

- Password hashing with `bcrypt`
- JWT authentication for protected routes
- Authorization checks for event ownership (organizer-only actions)
- Basic rate limiting on OTP resend in the user controller

## Deployment

This backend can be hosted on platforms like Render, Railway, Heroku, or any VPS/EC2 instance. Ensure environment variables are set and `MONGO_URI` is reachable from your host.

## Development notes

- The server entrypoint is `index.js`.
- Images upload to Cloudinary using `config/cloudinary.js`.
- Emails are sent using Gmail credentials from `mailUser`/`mailPass`.
- For local testing of payments, use the `/api/bookings/payment/success` simulate route.

## API Documentation / Testing

- Recommended: use Thunder Client or Postman to run and save API requests.

## License

Project files contain no license file; add one as needed.
