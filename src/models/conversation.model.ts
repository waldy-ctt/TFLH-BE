import { db } from "../config/database";

export interface Conversation {
  id: number;
  name: string;
  created_by: number;
  creator_name?: string;
  member_count?: number;
  created_at: string;
}

export interface ConversationMember {
  id: number;
  username: string;
  joined_at: string;
}

export const ConversationModel = {
  create(name: string, createdBy: number): Conversation {
    db.run("INSERT INTO conversations (name, created_by) VALUES (?, ?)", [name, createdBy]);
    return db.query("SELECT * FROM conversations ORDER BY id DESC LIMIT 1").get() as Conversation;
  },

  findById(id: number): Conversation | null {
    return db.query("SELECT * FROM conversations WHERE id = ?").get(id) as Conversation | null;
  },

  updateName(id: number, name: string): void {
    db.run("UPDATE conversations SET name = ? WHERE id = ?", [name, id]);
  },

  delete(id: number): void {
    db.run("DELETE FROM conversations WHERE id = ?", [id]);
  },

  getByUserId(userId: number): Conversation[] {
    return db.query(`
      SELECT DISTINCT c.*, u.username as creator_name,
        (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) as member_count
      FROM conversations c
      JOIN users u ON c.created_by = u.id
      JOIN conversation_members cm ON c.id = cm.conversation_id
      WHERE cm.user_id = ?
      ORDER BY c.created_at DESC
    `).all(userId) as Conversation[];
  },

  // Members
  addMember(conversationId: number, userId: number): void {
    db.run("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)", 
      [conversationId, userId]);
  },

  removeMember(conversationId: number, userId: number): void {
    db.run("DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?", 
      [conversationId, userId]);
  },

  getMembers(conversationId: number): ConversationMember[] {
    return db.query(`
      SELECT u.id, u.username, cm.joined_at
      FROM conversation_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.conversation_id = ?
      ORDER BY cm.joined_at ASC
    `).all(conversationId) as ConversationMember[];
  },

  getMemberCount(conversationId: number): number {
    const result = db.query(
      "SELECT COUNT(*) as count FROM conversation_members WHERE conversation_id = ?"
    ).get(conversationId) as { count: number };
    return result.count;
  },

  isMember(conversationId: number, userId: number): boolean {
    const result = db.query(
      "SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?"
    ).get(conversationId, userId);
    return !!result;
  }
};
