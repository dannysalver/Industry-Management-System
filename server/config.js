function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy server/.env.example to server/.env and fill it in, then start the server with "npm run dev" or "npm start".`
    );
  }
  return value;
}

export const JWT_SECRET = required('JWT_SECRET');
export const DATABASE_URL = required('DATABASE_URL');
