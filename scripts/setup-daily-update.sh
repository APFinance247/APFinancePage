#!/bin/bash

# NVDA Risk Chart - Daily CSV Update Setup Script
# This script helps you set up automated daily updates

echo "🚀 NVDA Risk Chart - Daily Update Setup"
echo "========================================"

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "📁 Project directory: $PROJECT_DIR"

# Check if we're in the right directory
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're running this from the nvda-risk-chart directory."
    exit 1
fi

echo ""
echo "Choose your automation method:"
echo "1) Local Cron Job (runs on your computer daily)"
echo "2) API Webhook URL (for external services)"
echo "3) Manual command reference"
echo ""

read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "📅 Setting up Local Cron Job"
        echo "============================"
        
        # Create the cron script
        cat > "$PROJECT_DIR/scripts/daily-update-cron.sh" << EOF
#!/bin/bash
# NVDA Risk Chart Daily Update Cron Script
# Generated on $(date)

cd "$PROJECT_DIR"
npm run update-csv-daily >> /tmp/nvda-update.log 2>&1
EOF
        
        chmod +x "$PROJECT_DIR/scripts/daily-update-cron.sh"
        
        echo "✅ Created cron script: $PROJECT_DIR/scripts/daily-update-cron.sh"
        echo ""
        echo "To schedule daily updates at 6 PM, run:"
        echo "crontab -e"
        echo ""
        echo "Then add this line:"
        echo "0 18 * * * $PROJECT_DIR/scripts/daily-update-cron.sh"
        echo ""
        echo "💡 This will update your CSV every day at 6 PM (after market close)"
        echo "📝 Logs will be saved to /tmp/nvda-update.log"
        ;;
        
    2)
        echo ""
        echo "🌐 API Webhook Setup"
        echo "==================="
        echo ""
        echo "Your API endpoint: http://localhost:3000/api/update-csv"
        echo ""
        echo "📋 cURL Example:"
        echo "curl -X POST http://localhost:3000/api/update-csv"
        echo ""
        echo "📋 For external services (replace with your domain):"
        echo "curl -X POST https://your-domain.com/api/update-csv"
        echo ""
        echo "🔗 Services you can use:"
        echo "  • GitHub Actions (daily scheduled workflow)"
        echo "  • Zapier/IFTTT (time-based triggers)"
        echo "  • AWS Lambda (scheduled functions)"
        echo "  • Google Cloud Functions (scheduled)"
        echo "  • Any webhook service with time triggers"
        ;;
        
    3)
        echo ""
        echo "📖 Manual Command Reference"
        echo "=========================="
        echo ""
        echo "🔄 Incremental update (recommended daily):"
        echo "npm run update-csv-daily"
        echo ""
        echo "🔄 Full regeneration (recommended weekly):"
        echo "npm run generate-csv"
        echo ""
        echo "🌐 API trigger (if server is running):"
        echo "curl -X POST http://localhost:3000/api/update-csv"
        echo ""
        echo "💡 The incremental update only processes new data points,"
        echo "   making it perfect for daily automation."
        ;;
        
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📊 Benefits of daily updates:"
echo "  • Always have the latest NVDA data"
echo "  • Minimal processing time (only new data)"
echo "  • Automatic risk level calculations"
echo "  • No manual intervention required"
echo ""
echo "🔍 Check update status:"
echo "  tail -f /tmp/nvda-update.log" 