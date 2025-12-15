import { db } from "../config/database";

export function createSystemMessage(convId: number, content: string) {
  db.run(
    "INSERT INTO messages (conversation_id, content, is_system) VALUES (?, ?, 1)",
    [convId, content]
  );
}
