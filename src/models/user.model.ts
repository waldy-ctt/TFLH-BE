import { db } from "../config/database";

export interface User {
  id: number;
  username: string;
  password?: string;
  created_at: string;
}

export const UserModel = {
  create(username: string, password: string): User {
    db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password]);
    return db.query("SELECT id, username, created_at FROM users WHERE username = ?").get(username) as User;
  },

  findByCredentials(username: string, password: string): User | null {
    return db.query("SELECT id, username, created_at FROM users WHERE username = ? AND password = ?")
      .get(username, password) as User | null;
  },

  findById(id: number): User | null {
    return db.query("SELECT id, username, created_at FROM users WHERE id = ?").get(id) as User | null;
  },

  findByUsername(username: string): User | null {
    return db.query("SELECT id, username FROM users WHERE username = ?").get(username) as User | null;
  },

  getAll(): User[] {
    return db.query("SELECT id, username FROM users ORDER BY username ASC").all() as User[];
  },

  search(query: string): User[] {
    return db.query("SELECT id, username FROM users WHERE username LIKE ? LIMIT 10")
      .all(`%${query}%`) as User[];
  },

  getUsername(id: number): string | null {
    const result = db.query("SELECT username FROM users WHERE id = ?").get(id) as { username: string } | null;
    return result?.username || null;
  }
};
