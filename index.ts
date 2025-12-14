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
    reply_to_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reply_to_id) REFERENCES messages(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS message_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(message_id, user_id, emoji)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS kick_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    target_user_id INTEGER NOT NULL,
    voter_user_id INTEGER NOT NULL,
    vote BOOLEAN NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (target_user_id) REFERENCES users(id),
    FOREIGN KEY (voter_user_id) REFERENCES users(id),
    UNIQUE(conversation_id, target_user_id, voter_user_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS delete_conversation_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    voter_user_id INTEGER NOT NULL,
    vote BOOLEAN NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (voter_user_id) REFERENCES users(id),
    UNIQUE(conversation_id, voter_user_id)
  )
`);

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

      // Get All Users (for adding to conversation)
      if (url.pathname === "/api/users" && req.method === "GET") {
        const users = db.query(`
          SELECT id, username 
          FROM users 
          ORDER BY username ASC
        `).all();
        
        return new Response(JSON.stringify(users), { headers });
      }

      // Create Conversation
      if (url.pathname === "/api/conversations" && req.method === "POST") {
        const { name, created_by, member_ids } = await req.json();
        
        db.run("INSERT INTO conversations (name, created_by) VALUES (?, ?)", [name, created_by]);
        const conv = db.query("SELECT * FROM conversations ORDER BY id DESC LIMIT 1").get();
        
        // Add creator as member
        db.run("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)", 
          [conv.id, created_by]);
        
        // Add selected members
        if (member_ids && Array.isArray(member_ids)) {
          for (const userId of member_ids) {
            if (userId !== created_by) {
              try {
                db.run("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)", 
                  [conv.id, userId]);
              } catch (e) {
                // Skip if already added
              }
            }
          }
        }
        
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

      // Update Conversation Name
      if (url.pathname.match(/^\/api\/conversations\/\d+$/) && req.method === "PUT") {
        const convId = url.pathname.split("/")[3];
        const { name, user_id } = await req.json();
        
        // Check if user is member
        const isMember = db.query(
          "SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?"
        ).get(convId, user_id);
        
        if (!isMember) {
          return new Response(JSON.stringify({ error: "Not a member" }), 
            { status: 403, headers });
        }
        
        db.run("UPDATE conversations SET name = ? WHERE id = ?", [name, convId]);
        return new Response(JSON.stringify({ success: true }), { headers });
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
        const { user_id } = await req.json();
        
        try {
          db.run("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)", 
            [convId, user_id]);
          return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
          return new Response(JSON.stringify({ error: "User already in conversation" }), 
            { status: 409, headers });
        }
      }

      // Leave Conversation
      if (url.pathname.match(/^\/api\/conversations\/\d+\/leave$/) && req.method === "POST") {
        const convId = url.pathname.split("/")[3];
        const { user_id } = await req.json();
        
        db.run("DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?", 
          [convId, user_id]);
        
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // Initiate Kick Vote
      if (url.pathname.match(/^\/api\/conversations\/\d+\/kick$/) && req.method === "POST") {
        const convId = url.pathname.split("/")[3];
        const { target_user_id, voter_user_id, vote } = await req.json();
        
        // Record vote
        try {
          db.run(`
            INSERT INTO kick_votes (conversation_id, target_user_id, voter_user_id, vote) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(conversation_id, target_user_id, voter_user_id) 
            DO UPDATE SET vote = excluded.vote
          `, [convId, target_user_id, voter_user_id, vote]);
        } catch (e) {
          // SQLite doesn't support ON CONFLICT in older versions, try delete then insert
          db.run("DELETE FROM kick_votes WHERE conversation_id = ? AND target_user_id = ? AND voter_user_id = ?",
            [convId, target_user_id, voter_user_id]);
          db.run("INSERT INTO kick_votes (conversation_id, target_user_id, voter_user_id, vote) VALUES (?, ?, ?, ?)",
            [convId, target_user_id, voter_user_id, vote]);
        }
        
        // Check if 70% voted yes
        const totalMembers = db.query(
          "SELECT COUNT(*) as count FROM conversation_members WHERE conversation_id = ?"
        ).get(convId).count;
        
        const yesVotes = db.query(
          "SELECT COUNT(*) as count FROM kick_votes WHERE conversation_id = ? AND target_user_id = ? AND vote = 1"
        ).get(convId, target_user_id).count;
        
        if (yesVotes >= totalMembers * 0.7) {
          // Kick the user
          db.run("DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?", 
            [convId, target_user_id]);
          db.run("DELETE FROM kick_votes WHERE conversation_id = ? AND target_user_id = ?",
            [convId, target_user_id]);
          return new Response(JSON.stringify({ success: true, kicked: true }), { headers });
        }
        
        return new Response(JSON.stringify({ success: true, kicked: false }), { headers });
      }

      // Get Kick Votes Status
      if (url.pathname.match(/^\/api\/conversations\/\d+\/kick\/\d+$/) && req.method === "GET") {
        const parts = url.pathname.split("/");
        const convId = parts[3];
        const targetUserId = parts[5];
        
        const votes = db.query(`
          SELECT kv.*, u.username 
          FROM kick_votes kv
          JOIN users u ON kv.voter_user_id = u.id
          WHERE kv.conversation_id = ? AND kv.target_user_id = ?
        `).all(convId, targetUserId);
        
        const totalMembers = db.query(
          "SELECT COUNT(*) as count FROM conversation_members WHERE conversation_id = ?"
        ).get(convId).count;
        
        return new Response(JSON.stringify({ votes, totalMembers }), { headers });
      }

      // Vote to Delete Conversation
      if (url.pathname.match(/^\/api\/conversations\/\d+\/delete-vote$/) && req.method === "POST") {
        const convId = url.pathname.split("/")[3];
        const { voter_user_id, vote } = await req.json();
        
        // Record vote
        try {
          db.run(`
            INSERT INTO delete_conversation_votes (conversation_id, voter_user_id, vote) 
            VALUES (?, ?, ?)
            ON CONFLICT(conversation_id, voter_user_id) 
            DO UPDATE SET vote = excluded.vote
          `, [convId, voter_user_id, vote]);
        } catch (e) {
          db.run("DELETE FROM delete_conversation_votes WHERE conversation_id = ? AND voter_user_id = ?",
            [convId, voter_user_id]);
          db.run("INSERT INTO delete_conversation_votes (conversation_id, voter_user_id, vote) VALUES (?, ?, ?)",
            [convId, voter_user_id, vote]);
        }
        
        // Check if all members voted yes
        const totalMembers = db.query(
          "SELECT COUNT(*) as count FROM conversation_members WHERE conversation_id = ?"
        ).get(convId).count;
        
        const yesVotes = db.query(
          "SELECT COUNT(*) as count FROM delete_conversation_votes WHERE conversation_id = ? AND vote = 1"
        ).get(convId).count;
        
        if (yesVotes === totalMembers) {
          // Delete conversation and all related data
          db.run("DELETE FROM messages WHERE conversation_id = ?", [convId]);
          db.run("DELETE FROM conversation_members WHERE conversation_id = ?", [convId]);
          db.run("DELETE FROM kick_votes WHERE conversation_id = ?", [convId]);
          db.run("DELETE FROM delete_conversation_votes WHERE conversation_id = ?", [convId]);
          db.run("DELETE FROM conversations WHERE id = ?", [convId]);
          return new Response(JSON.stringify({ success: true, deleted: true }), { headers });
        }
        
        return new Response(JSON.stringify({ success: true, deleted: false }), { headers });
      }

      // Get Delete Votes Status
      if (url.pathname.match(/^\/api\/conversations\/\d+\/delete-vote$/) && req.method === "GET") {
        const convId = url.pathname.split("/")[3];
        
        const votes = db.query(`
          SELECT dv.*, u.username 
          FROM delete_conversation_votes dv
          JOIN users u ON dv.voter_user_id = u.id
          WHERE dv.conversation_id = ?
        `).all(convId);
        
        const totalMembers = db.query(
          "SELECT COUNT(*) as count FROM conversation_members WHERE conversation_id = ?"
        ).get(convId).count;
        
        return new Response(JSON.stringify({ votes, totalMembers }), { headers });
      }

      // Get Messages for Conversation
      if (url.pathname.match(/^\/api\/conversations\/\d+\/messages$/) && req.method === "GET") {
        const convId = url.pathname.split("/")[3];
        
        const messages = db.query(`
          SELECT m.*, u.username,
            (SELECT json_group_array(json_object('user_id', mr.user_id, 'username', u2.username, 'emoji', mr.emoji))
             FROM message_reactions mr
             JOIN users u2 ON mr.user_id = u2.id
             WHERE mr.message_id = m.id) as reactions_json
          FROM messages m 
          JOIN users u ON m.user_id = u.id 
          WHERE m.conversation_id = ?
          ORDER BY m.created_at ASC
        `).all(convId);
        
        // Parse reactions JSON and get reply information
        const parsedMessages = messages.map(msg => {
          let replyToMessage = null;
          if (msg.reply_to_id) {
            replyToMessage = db.query(`
              SELECT m.id, m.content, u.username
              FROM messages m
              JOIN users u ON m.user_id = u.id
              WHERE m.id = ?
            `).get(msg.reply_to_id);
          }
          
          return {
            ...msg,
            reactions: msg.reactions_json ? JSON.parse(msg.reactions_json).filter(r => r.user_id) : [],
            reply_to: replyToMessage
          };
        });
        
        return new Response(JSON.stringify(parsedMessages), { headers });
      }

      // Send Message
      if (url.pathname.match(/^\/api\/conversations\/\d+\/messages$/) && req.method === "POST") {
        const convId = url.pathname.split("/")[3];
        const { user_id, content, reply_to_id } = await req.json();
        
        // Check if user is member
        const isMember = db.query(
          "SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?"
        ).get(convId, user_id);
        
        if (!isMember) {
          return new Response(JSON.stringify({ error: "Not a member of this conversation" }), 
            { status: 403, headers });
        }
        
        db.run("INSERT INTO messages (conversation_id, user_id, content, reply_to_id) VALUES (?, ?, ?, ?)", 
          [convId, user_id, content, reply_to_id || null]);
        
        const msg = db.query(`
          SELECT m.*, u.username 
          FROM messages m 
          JOIN users u ON m.user_id = u.id 
          ORDER BY m.id DESC LIMIT 1
        `).get();
        
        // Get reply information if exists
        let replyToMessage = null;
        if (msg.reply_to_id) {
          replyToMessage = db.query(`
            SELECT m.id, m.content, u.username
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.id = ?
          `).get(msg.reply_to_id);
        }
        
        return new Response(JSON.stringify({ ...msg, reactions: [], reply_to: replyToMessage }), { headers });
      }

      // Delete Message
      if (url.pathname.match(/^\/api\/messages\/\d+$/) && req.method === "DELETE") {
        const msgId = url.pathname.split("/")[3];
        const { user_id } = await req.json();
        
        const msg = db.query("SELECT user_id FROM messages WHERE id = ?").get(msgId);
        
        if (!msg || msg.user_id !== user_id) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), 
            { status: 403, headers });
        }
        
        db.run("DELETE FROM message_reactions WHERE message_id = ?", [msgId]);
        db.run("DELETE FROM messages WHERE id = ?", [msgId]);
        
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // Add/Remove Reaction
      if (url.pathname.match(/^\/api\/messages\/\d+\/react$/) && req.method === "POST") {
        const msgId = url.pathname.split("/")[3];
        const { user_id, emoji } = await req.json();
        
        const existing = db.query(
          "SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?"
        ).get(msgId, user_id, emoji);
        
        if (existing) {
          // Remove reaction
          db.run("DELETE FROM message_reactions WHERE id = ?", [existing.id]);
          return new Response(JSON.stringify({ action: "removed" }), { headers });
        } else {
          // Add reaction
          db.run("INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)",
            [msgId, user_id, emoji]);
          return new Response(JSON.stringify({ action: "added" }), { headers });
        }
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
