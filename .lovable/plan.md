
# Telegram Link Librarian — MVP Plan

## Overview
A dark-themed developer tool that auto-captures links from a Telegram channel, analyzes them with AI, and presents them in a fast, searchable dashboard. Built on Lovable Cloud (Supabase) with a Telegram Bot webhook.

---

## 1. Authentication
- **Password or magic link login** via Supabase Auth (email-based)
- Single user — only you can access the dashboard

## 2. Database Schema
- **links** table: stores each unique URL with its AI-generated title, summary, tags, content type, key points, domain, original URL, canonical URL, status (pending/ready/failed), and timestamps
- **saves** table: tracks each time a link was saved (Telegram message ID, chat ID, timestamp, raw message text, user note) — enables dedup tracking ("saved again" records)
- Full-text search index on title, summary, and tags

## 3. Telegram Bot Integration
- A Supabase Edge Function acts as the **webhook endpoint** for your Telegram Bot
- When you paste a link in your channel, Telegram sends the message to the webhook
- The function extracts all URLs and any surrounding text from the message
- For each URL: checks for duplicates, creates a new link entry (status: "pending"), and creates a save record
- **Setup**: You create a bot via @BotFather, add it as admin to your channel, and set the webhook URL to the edge function

## 4. Link Analysis Pipeline
- A separate Edge Function processes pending links:
  - Fetches the URL to extract page metadata (title, description, OG tags)
  - Expands shortened URLs (follows redirects)
  - Classifies content type (article, video, repo, docs, tool, thread, other)
  - Calls **Lovable AI** (Gemini) with structured output to generate:
    - Clean title
    - 1–3 sentence summary
    - 3–10 tags
    - Key bullet points
    - Confidence score
  - Updates the link record with results and sets status to "ready"
  - If analysis fails, marks as "failed" for manual retry

## 5. Web Dashboard (Dark Developer Theme)
- **Dark mode** with dense information layout, monospace accents, keyboard-friendly

### Views:
- **Inbox**: Newly added / recently saved links, sorted by date
- **Search**: Full-text search bar across titles, summaries, and tags — results appear instantly
- **Browse**: Filter by tags, content type, and date range; sort by newest or most relevant

### Link Detail:
- Title, summary, tags (editable), content type badge
- Key bullet points
- Original URL (one-click copy), domain info
- Telegram message link (when available)
- Editable notes field
- "Saved X times" indicator with history
- Pin / favorite toggle

### Quick Actions:
- One-click copy URL
- Edit tags inline
- Add/edit notes
- Retry failed analysis
- Pin/favorite

## 6. Telegram Reply (Configurable)
- **Off by default**, toggle in settings
- When enabled, the bot replies to your message in Telegram with the generated title, tags, and summary so your channel becomes readable too

## 7. What's Deferred (Post-MVP)
- Collections / saved searches
- CSV/JSON export
- Semantic search with embeddings
- Bulk import from existing Telegram history
- Keyboard shortcuts

---

## Setup Flow (for you)
1. Create a Telegram bot via @BotFather
2. Add the bot as admin to your channel/group
3. Provide the bot token as a secret in Lovable
4. The app sets the webhook automatically
5. Start pasting links — they appear in your dashboard within seconds
