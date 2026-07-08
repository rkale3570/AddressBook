export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/addressbook',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
});
