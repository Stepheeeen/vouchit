# Production Deployment Instructions for Vouchit

## Backend (NestJS)

1. **Set Environment Variables**
   - Copy `.env.example` to `backend/.env` and fill in production values.
   - Ensure `DATABASE_URL` and `JWT_SECRET` are set securely.

2. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Build and Start**
   ```bash
   npm run build:prod
   npm run start:prod
   ```

4. **CORS**
   - CORS is enabled by default. For production, restrict origins in `main.ts` if needed.

5. **Database**
   - Ensure your production database is accessible and migrated.
   ```bash
   npx prisma migrate deploy
   ```

---

## Frontend (Next.js)

1. **Set Environment Variables**
   - Copy `.env.example` to `frontend/.env` and set `NEXT_PUBLIC_API_URL` to your backend's public URL.

2. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Build and Start**
   ```bash
   npm run build
   npm run start:prod
   ```

4. **Static Hosting**
   - If using Vercel or similar, follow their deployment guides.

---

## General Recommendations
- Use HTTPS in production.
- Set strong secrets and never commit real secrets to git.
- Use process managers (e.g., PM2) or Docker for backend reliability.
- Monitor logs and errors.
- Regularly update dependencies.
