import { db } from "../config/database";

export interface Message {
  id: number;
  conversation_id: number;
  user_id: number | null;
  username?: string;
  content: string;
  reply_to_id?: number;
  reply_to?: {
    id: number;
    content: string;
    username: string;
  };
  is_system: boolean;
  reactions?: Reaction[];
  created_at: string;
}

export interface Reaction {
  user_id: number;
  username: string;
  emoji: string;
}

export const MessageModel = {
  create(conversationId: number, userId: number | null, content: string, replyToId?: number, isSystem: boolean = false): number {
    db.run(
      "INSERT INTO messages (conversation_id, user_id, content, reply_to_id, is_system) VALUES (?, ?, ?, ?, ?)",
      [conversationId, userId, content, replyToId || null, isSystem ? 1 : 0]
    );
    const result = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
    return result.id;
  },

  createSystem(conversationId: number, content: string): void {
    db.run(
      "INSERT INTO messages (conversation_id, content, is_system) VALUES (?, ?, 1)",
      [conversationId, content]
    );
  },

  findById(id: number): Message | null {
    return db.query("SELECT * FROM messages WHERE id = ?").get(id) as Message | null;
  },

  delete(id: number): void {
    db.run("DELETE FROM message_reactions WHERE message_id = ?", [id]);
    db.run("DELETE FROM messages WHERE id = ?", [id]);
  },

  getByConversation(conversationId: number): Message[] {
    const messages = db.query(`
      SELECT m.*, u.username,
        (SELECT json_group_array(json_object('user_id', mr.user_id, 'username', u2.username, 'emoji', mr.emoji))
         FROM message_reactions mr
         JOIN users u2 ON mr.user_id = u2.id
         WHERE mr.message_id = m.id) as reactions_json
      FROM messages m 
      LEFT JOIN users u ON m.user_id = u.id 
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `).all(conversationId);

    return messages.map(msg => {
      let replyToMessage = null;
      if (msg.reply_to_id) {
        replyToMessage = db.query(`
          SELECT m.id, m.content, u.username
          FROM messages m
          LEFT JOIN users u ON m.user_id = u.id
          WHERE m.id = ?
        `).get(msg.reply_to_id);
      }

      return {
        ...msg,
        username: msg.username || "System",
        reactions: msg.reactions_json ? JSON.parse(msg.reactions_json).filter((r: any) => r.user_id) : [],
        reply_to: replyToMessage
      };
    }) as Message[];
  },

  getLastMessage(): Message {
    return db.query(`
      SELECT m.*, u.username 
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      ORDER BY m.id DESC LIMIT 1
    `).get() as Message;
  },

  deleteByConversation(conversationId: number): void {
    db.run("DELETE FROM messages WHERE conversation_id = ?", [conversationId]);
  },

  // Reactions
  addReaction(messageId: number, userId: number, emoji: string): void {
    db.run("INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)",
      [messageId, userId, emoji]);
  },

  removeReaction(reactionId: number): void {
    db.run("DELETE FROM message_reactions WHERE id = ?", [reactionId]);
  },

  findReaction(messageId: number, userId: number, emoji: string): { id: number } | null {
    return db.query(
      "SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?"
    ).get(messageId, userId, emoji) as { id: number } | null;
  }
};
