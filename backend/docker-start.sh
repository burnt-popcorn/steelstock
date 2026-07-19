#!/bin/sh

echo "Waiting for PostgreSQL database to start..."
# Loop until prisma can successfully push the schema (verifying DB connection is ready)
until npx prisma db push --accept-data-loss; do
  echo "Database is not ready yet... retrying in 3 seconds"
  sleep 3
done

echo "Database connection verified and schema synced!"

echo "Running seed script..."
node prisma/seed.js

echo "Starting Express backend server..."
npm run start
