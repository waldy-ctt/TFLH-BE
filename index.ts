import { Database } from "bun:sqlite";

const db = new Database("chat.db");

// Initialize DB
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS conversation_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(conversation_id, user_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    try {
      // Sign Up
      if (url.pathname === "/api/signup" && req.method === "POST") {
        const { username, password } = await req.json();
        
        if (!username || !password) {
          return new Response(JSON.stringify({ error: "Username and password required" }), 
            { status: 400, headers });
        }

        try {
          db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password]);
          const user = db.query("SELECT id, username, created_at FROM users WHERE username = ?").get(username);
          return new Response(JSON.stringify(user), { headers });
        } catch (e) {
          return new Response(JSON.stringify({ error: "Username already exists" }), 
            { status: 409, headers });
        }
      }

      // Sign In
      if (url.pathname === "/api/signin" && req.method === "POST") {
        const { username, password } = await req.json();
        
        const user = db.query("SELECT id, username, created_at FROM users WHERE username = ? AND password = ?")
          .get(username, password);
        
        if (!user) {
          return new Response(JSON.stringify({ error: "Invalid credentials" }), 
            { status: 401, headers });
        }
        
        return new Response(JSON.stringify(user), { headers });
      }

      // Create Conversation
      if (url.pathname === "/api/conversations" && req.method === "POST") {
        const { name, created_by } = await req.json();
        
        db.run("INSERT INTO conversations (name, created_by) VALUES (?, ?)", [name, created_by]);
        const conv = db.query("SELECT * FROM conversations ORDER BY id DESC LIMIT 1").get();
        
        // Add creator as member
        db.run("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)", 
          [conv.id, created_by]);
        
        return new Response(JSON.stringify(conv), { headers });
      }

      // Get User's Conversations
      if (url.pathname === "/api/conversations" && req.method === "GET") {
        const userId = url.searchParams.get("user_id");
        
        const conversations = db.query(`
          SELECT DISTINCT c.*, u.username as creator_name,
            (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) as member_count
          FROM conversations c
          JOIN users u ON c.created_by = u.id
          JOIN conversation_members cm ON c.id = cm.conversation_id
          WHERE cm.user_id = ?
          ORDER BY c.created_at DESC
        `).all(userId);
        
        return new Response(JSON.stringify(conversations), { headers });
      }

      // Get Conversation Members
      if (url.pathname.match(/^\/api\/conversations\/\d+\/members$/) && req.method === "GET") {
        const convId = url.pathname.split("/")[3];
        
        const members = db.query(`
          SELECT u.id, u.username, cm.joined_at
          FROM conversation_members cm
          JOIN users u ON cm.user_id = u.id
          WHERE cm.conversation_id = ?
          ORDER BY cm.joined_at ASC
        `).all(convId);
        
        return new Response(JSON.stringify(members), { headers });
      }

      // Add Member to Conversation
      if (url.pathname.match(/^\/api\/conversations\/\d+\/members$/) && req.method === "POST") {
        const convId = url.pathname.split("/")[3];
        const { username } = await req.json();
        
        const user = db.query("SELECT id FROM users WHERE username = ?").get(username);
        
        if (!user) {
          return new Response(JSON.stringify({ error: "User not found" }), 
            { status: 404, headers });
        }
        
        try {
          db.run("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)", 
            [convId, user.id]);
          return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
          return new Response(JSON.stringify({ error: "User already in conversation" }), 
            { status: 409, headers });
        }
      }

      // Get Messages for Conversation
      if (url.pathname.match(/^\/api\/conversations\/\d+\/messages$/) && req.method === "GET") {
        const convId = url.pathname.split("/")[3];
        
        const messages = db.query(`
          SELECT m.*, u.username 
          FROM messages m 
          JOIN users u ON m.user_id = u.id 
          WHERE m.conversation_id = ?
          ORDER BY m.created_at ASC
        `).all(convId);
        
        return new Response(JSON.stringify(messages), { headers });
      }

      // Send Message
      if (url.pathname.match(/^\/api\/conversations\/\d+\/messages$/) && req.method === "POST") {
        const convId = url.pathname.split("/")[3];
        const { user_id, content } = await req.json();
        
        // Check if user is member
        const isMember = db.query(
          "SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?"
        ).get(convId, user_id);
        
        if (!isMember) {
          return new Response(JSON.stringify({ error: "Not a member of this conversation" }), 
            { status: 403, headers });
        }
        
        db.run("INSERT INTO messages (conversation_id, user_id, content) VALUES (?, ?, ?)", 
          [convId, user_id, content]);
        
        const msg = db.query(`
          SELECT m.*, u.username 
          FROM messages m 
          JOIN users u ON m.user_id = u.id 
          ORDER BY m.id DESC LIMIT 1
        `).get();
        
        return new Response(JSON.stringify(msg), { headers });
      }

      // Search Users
      if (url.pathname === "/api/users/search" && req.method === "GET") {
        const query = url.searchParams.get("q");
        
        const users = db.query(`
          SELECT id, username 
          FROM users 
          WHERE username LIKE ? 
          LIMIT 10
        `).all(`%${query}%`);
        
        return new Response(JSON.stringify(users), { headers });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers });

    } catch (error) {
      console.error("Server error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), 
        { status: 500, headers });
    }
  },
});

console.log(`🚀 TFLH Backend running on http://localhost:${server.port}`);
