# 🤖 Automated Daily CSV Updates

## Overview

Instead of manually running `npm run generate-csv` daily, you can set up **automated incremental updates** that only process new data points. This is much more efficient and can run automatically.

## 🚀 Quick Setup

Run the interactive setup assistant:
```bash
npm run setup-automation
```

This will guide you through setting up automation with your preferred method.

## 📊 Update Methods Comparison

| Method | Frequency | Processing | Best For |
|--------|-----------|------------|----------|
| **Incremental Daily** | Daily | ~1 new data point | 🟢 **Recommended** |
| **Full Regeneration** | Weekly | ~6,653 data points | 🟡 Periodic refresh |

## 🔄 Available Commands

### Daily Incremental Update (Recommended)
```bash
npm run update-csv-daily
```
- ✅ Only processes new data points
- ✅ ~99% faster than full regeneration
- ✅ Perfect for daily automation
- ✅ Maintains identical accuracy

### API Endpoint
```bash
curl -X POST http://localhost:3000/api/update-csv
```
- ✅ Can be called from external services
- ✅ Returns JSON status response
- ✅ Perfect for webhooks

### Full Regeneration
```bash
npm run generate-csv
```
- 🟡 Recalculates everything from scratch
- 🟡 Use weekly/monthly for verification
- 🟡 Takes longer but ensures data integrity

## 🕒 Automation Options

### 1. Local Cron Job (Recommended for Development)

**Setup:**
```bash
npm run setup-automation
# Choose option 1
```

**Manual Setup:**
```bash
# Edit crontab
crontab -e

# Add this line (updates daily at 6 PM):
0 18 * * * cd /path/to/nvda-risk-chart && npm run update-csv-daily >> /tmp/nvda-update.log 2>&1
```

**Check Status:**
```bash
tail -f /tmp/nvda-update.log
```

### 2. GitHub Actions (Recommended for Production)

**Automatic Setup:**
- The `.github/workflows/update-csv-daily.yml` file is already included
- Push your repository to GitHub
- GitHub will automatically run daily updates at 6 PM EST
- Changes are committed back to your repository

**Features:**
- ✅ Runs on weekdays only (market days)
- ✅ Automatic commits when data changes
- ✅ No local computer required
- ✅ Free for public repositories

**Manual Trigger:**
- Go to GitHub Actions tab
- Click "Update NVDA CSV Daily"
- Click "Run workflow"

### 3. API Webhook Automation

**Services you can use:**
- **Zapier/IFTTT**: Time-based triggers → Webhook to your API
- **AWS Lambda**: Scheduled functions
- **Google Cloud Functions**: Cloud Scheduler
- **Vercel Cron**: If deployed on Vercel
- **Any webhook service**: With time-based triggers

**API Endpoint:**
```
POST /api/update-csv
```

**Example Response:**
```json
{
  "success": true,
  "status": "up-to-date",
  "message": "CSV is already current with the latest data",
  "timestamp": "2025-01-XX T18:00:00.000Z"
}
```

### 4. Vercel Cron (If Deployed on Vercel)

Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/update-csv",
      "schedule": "0 18 * * 1-5"
    }
  ]
}
```

## 🔍 Monitoring & Logs

### Local Monitoring
```bash
# View update logs
tail -f /tmp/nvda-update.log

# Check if CSV was recently updated
ls -la public/nvda-historical-data.csv
```

### GitHub Actions Monitoring
- Go to your repository → Actions tab
- View workflow runs and summaries
- Get notifications on failures (configurable)

### API Monitoring
```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/update-csv

# Check response status
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/update-csv
```

## 🛠️ Troubleshooting

### "CSV file not found"
```bash
# Create initial CSV first:
npm run generate-csv
```

### "API connection failed"
```bash
# Make sure your Next.js app is running:
npm run dev
```

### Cron job not running
```bash
# Check if cron service is running:
systemctl status cron  # Linux
# or
launchctl list | grep cron  # macOS

# View cron logs:
grep CRON /var/log/syslog  # Linux
```

### GitHub Actions not running
- Check if repository has Actions enabled
- Verify the workflow file is in `.github/workflows/`
- Check if the repository is public (free tier)

## 📈 Performance Benefits

### Before Automation:
- 🔴 Manual daily updates required
- 🔴 Risk of forgetting updates
- 🔴 Full recalculation every time (~6,653 points)

### After Automation:
- ✅ Automatic daily updates
- ✅ Only processes new data (~1 point)
- ✅ 99% faster processing
- ✅ Always up-to-date data
- ✅ No manual intervention

## 🎯 Recommended Workflow

### For Development:
1. **Initial Setup:** `npm run generate-csv`
2. **Daily Automation:** Set up local cron job
3. **Weekly Verification:** `npm run generate-csv` (optional)

### For Production:
1. **Initial Setup:** `npm run generate-csv`
2. **Daily Automation:** GitHub Actions (automatic)
3. **API Integration:** Use `/api/update-csv` endpoint
4. **Monitoring:** GitHub Actions dashboard

## 🔒 Security Considerations

### Local Setup:
- CSV files are stored locally
- No external dependencies for data storage
- Your API keys remain secure

### GitHub Actions:
- Runs in isolated GitHub environment
- Commits are signed by GitHub Actions
- No sensitive data exposed in workflows

### API Endpoint:
- Consider adding authentication for production
- Rate limiting recommended for public deployments
- Monitor API usage logs

## 📅 Scheduling Recommendations

### Optimal Times:
- **6 PM EST**: After US market close (recommended)
- **7 PM EST**: Buffer for data availability
- **Weekdays Only**: Markets are closed weekends

### Frequency:
- **Daily**: Recommended for active monitoring
- **Weekdays Only**: Saves resources on non-trading days
- **Multiple Times**: Not recommended (data doesn't change intraday)

## 🎉 Success Indicators

You'll know automation is working when:
- ✅ CSV file updates daily with new dates
- ✅ No manual intervention required
- ✅ Risk calculations stay current
- ✅ Chart shows latest data automatically
- ✅ Logs show successful updates

## 💡 Tips

1. **Start Simple**: Begin with local cron job
2. **Monitor Initially**: Watch logs for first few days
3. **Set Reminders**: Weekly check that automation is working
4. **Backup Strategy**: Keep weekly full regenerations
5. **Version Control**: Use GitHub Actions for change tracking 