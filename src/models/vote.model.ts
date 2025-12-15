import { db } from "../config/database";

export interface KickVote {
  id: number;
  conversation_id: number;
  target_user_id: number;
  voter_user_id: number;
  username?: string;
  vote: boolean;
  created_at: string;
}

export interface DeleteVote {
  id: number;
  conversation_id: number;
  voter_user_id: number;
  username?: string;
  vote: boolean;
  created_at: string;
}

export const VoteModel = {
  // Kick votes
  upsertKickVote(conversationId: number, targetUserId: number, voterUserId: number, vote: boolean): void {
    try {
      db.run(`
        INSERT INTO kick_votes (conversation_id, target_user_id, voter_user_id, vote) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(conversation_id, target_user_id, voter_user_id) 
        DO UPDATE SET vote = excluded.vote
      `, [conversationId, targetUserId, voterUserId, vote]);
    } catch (e) {
      // Fallback for SQLite versions without UPSERT
      db.run("DELETE FROM kick_votes WHERE conversation_id = ? AND target_user_id = ? AND voter_user_id = ?",
        [conversationId, targetUserId, voterUserId]);
      db.run("INSERT INTO kick_votes (conversation_id, target_user_id, voter_user_id, vote) VALUES (?, ?, ?, ?)",
        [conversationId, targetUserId, voterUserId, vote]);
    }
  },

  getKickVotes(conversationId: number, targetUserId: number): KickVote[] {
    return db.query(`
      SELECT kv.*, u.username 
      FROM kick_votes kv
      JOIN users u ON kv.voter_user_id = u.id
      WHERE kv.conversation_id = ? AND kv.target_user_id = ?
    `).all(conversationId, targetUserId) as KickVote[];
  },

  getKickYesVotes(conversationId: number, targetUserId: number): number {
    const result = db.query(
      "SELECT COUNT(*) as count FROM kick_votes WHERE conversation_id = ? AND target_user_id = ? AND vote = 1"
    ).get(conversationId, targetUserId) as { count: number };
    return result.count;
  },

  deleteKickVotes(conversationId: number, targetUserId: number): void {
    db.run("DELETE FROM kick_votes WHERE conversation_id = ? AND target_user_id = ?",
      [conversationId, targetUserId]);
  },

  deleteKickVotesByConversation(conversationId: number): void {
    db.run("DELETE FROM kick_votes WHERE conversation_id = ?", [conversationId]);
  },

  // Delete conversation votes
  upsertDeleteVote(conversationId: number, voterUserId: number, vote: boolean): void {
    try {
      db.run(`
        INSERT INTO delete_conversation_votes (conversation_id, voter_user_id, vote) 
        VALUES (?, ?, ?)
        ON CONFLICT(conversation_id, voter_user_id) 
        DO UPDATE SET vote = excluded.vote
      `, [conversationId, voterUserId, vote]);
    } catch (e) {
      db.run("DELETE FROM delete_conversation_votes WHERE conversation_id = ? AND voter_user_id = ?",
        [conversationId, voterUserId]);
      db.run("INSERT INTO delete_conversation_votes (conversation_id, voter_user_id, vote) VALUES (?, ?, ?)",
        [conversationId, voterUserId, vote]);
    }
  },

  getDeleteVotes(conversationId: number): DeleteVote[] {
    return db.query(`
      SELECT dv.*, u.username 
      FROM delete_conversation_votes dv
      JOIN users u ON dv.voter_user_id = u.id
      WHERE dv.conversation_id = ?
    `).all(conversationId) as DeleteVote[];
  },

  getDeleteYesVotes(conversationId: number): number {
    const result = db.query(
      "SELECT COUNT(*) as count FROM delete_conversation_votes WHERE conversation_id = ? AND vote = 1"
    ).get(conversationId) as { count: number };
    return result.count;
  },

  deleteDeleteVotes(conversationId: number): void {
    db.run("DELETE FROM delete_conversation_votes WHERE conversation_id = ?", [conversationId]);
  }
};
