-- Fluence Lead Scanner - D1 Database Schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'rep',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  -- Contact
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  title TEXT DEFAULT '',
  company TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  country TEXT DEFAULT '',
  linkedin TEXT DEFAULT '',
  
  -- Opportunity
  temperature TEXT DEFAULT '',  -- hot, warm, cold
  deal_size TEXT DEFAULT '',
  timeline TEXT DEFAULT '',
  products TEXT DEFAULT '[]',  -- JSON array
  notes TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  
  -- Next action
  action TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  priority TEXT DEFAULT '',
  
  -- Voice note (base64 or URL)
  voice_note TEXT DEFAULT '',
  voice_tags TEXT DEFAULT '[]',
  
  -- Scan
  scan_text TEXT DEFAULT '',
  
  -- Event
  event_name TEXT DEFAULT 'ISE 2026',
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
