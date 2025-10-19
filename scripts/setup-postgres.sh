#!/bin/bash

# PostgreSQL Setup Script for Printing Workflow
# This script helps you set up PostgreSQL via Railway

echo "🚀 Printing Workflow - PostgreSQL Setup"
echo "========================================"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed"
    echo "Install it with: npm install -g @railway/cli"
    exit 1
fi

echo "✅ Railway CLI found"
echo ""

# Check if logged in
echo "Checking Railway authentication..."
railway whoami &> /dev/null
if [ $? -ne 0 ]; then
    echo "🔐 Please login to Railway:"
    railway login
    if [ $? -ne 0 ]; then
        echo "❌ Railway login failed"
        exit 1
    fi
fi

echo "✅ Logged in to Railway"
echo ""

# List existing services
echo "Checking existing Railway services..."
railway service

echo ""
echo "📊 Do you want to:"
echo "  1) Add PostgreSQL to existing project"
echo "  2) Create new Railway project with PostgreSQL"
echo "  3) Show existing DATABASE_URL"
echo ""
read -p "Enter choice (1/2/3): " choice

case $choice in
  1)
    echo ""
    echo "Adding PostgreSQL to existing project..."
    railway add --service postgres
    echo ""
    echo "✅ PostgreSQL added!"
    echo ""
    echo "Getting DATABASE_URL..."
    railway variables --service postgres | grep DATABASE_URL
    echo ""
    echo "📝 Copy the DATABASE_URL above and add it to your .env file"
    ;;
  2)
    echo ""
    read -p "Enter project name: " project_name
    railway init --name "$project_name"
    railway add --service postgres
    echo ""
    echo "✅ PostgreSQL created!"
    echo ""
    echo "Getting DATABASE_URL..."
    railway variables --service postgres | grep DATABASE_URL
    echo ""
    echo "📝 Copy the DATABASE_URL above and add it to your .env file"
    ;;
  3)
    echo ""
    echo "Current DATABASE_URL from Railway:"
    railway variables --service postgres | grep DATABASE_URL
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "🎉 Next steps:"
echo "  1. Update .env with the DATABASE_URL"
echo "  2. Run: cd packages/db && npx prisma generate"
echo "  3. Run: cd packages/db && npx prisma db push"
echo "  4. Run: cd packages/db && npx tsx src/seed.ts"
echo ""
