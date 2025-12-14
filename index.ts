import { Database } from "bun:sqlite";

const db = new Database("chat.db");

// Initialize DB
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // Login/Register
    if (url.pathname === "/api/login" && req.method === "POST") {
      const { username } = await req.json();
      try {
        db.run("INSERT INTO users (username) VALUES (?)", [username]);
      } catch (e) {
        // User already exists, that's fine
      }
      const user = db.query("SELECT * FROM users WHERE username = ?").get(username);
      return new Response(JSON.stringify(user), { headers });
    }

    // Get messages
    if (url.pathname === "/api/messages" && req.method === "GET") {
      const messages = db.query(`
        SELECT m.*, u.username 
        FROM messages m 
        JOIN users u ON m.user_id = u.id 
        ORDER BY m.created_at ASC
      `).all();
      return new Response(JSON.stringify(messages), { headers });
    }

    // Send message
    if (url.pathname === "/api/messages" && req.method === "POST") {
      const { user_id, content } = await req.json();
      db.run("INSERT INTO messages (user_id, content) VALUES (?, ?)", [user_id, content]);
      const msg = db.query(`
        SELECT m.*, u.username 
        FROM messages m 
        JOIN users u ON m.user_id = u.id 
        ORDER BY m.id DESC LIMIT 1
      `).get();
      return new Response(JSON.stringify(msg), { headers });
    }

    return new Response("Not Found", { status: 404, headers });
  },
});

console.log(`🚀 TFLH Backend running on http://localhost:${server.port}`);
