import { MessageModel } from "../models/message.model";
import { ConversationModel } from "../models/conversation.model";
import { successResponse, errorResponse } from "../utils/response";

export async function getMessages(url: URL) {
  const convId = parseInt(url.pathname.split("/")[3]);
  const messages = MessageModel.getByConversation(convId);
  return successResponse(messages);
}

export async function sendMessage(url: URL, req: Request) {
  const convId = parseInt(url.pathname.split("/")[3]);
  const { user_id, content, reply_to_id } = await req.json();
  
  if (!ConversationModel.isMember(convId, user_id)) {
    return errorResponse("Not a member of this conversation", 403);
  }
  
  MessageModel.create(convId, user_id, content, reply_to_id);
  const msg = MessageModel.getLastMessage();
  
  // Get reply information if exists
  let replyToMessage = null;
  if (msg.reply_to_id) {
    replyToMessage = MessageModel.findById(msg.reply_to_id);
  }
  
  return successResponse({ ...msg, reactions: [], reply_to: replyToMessage });
}

export async function deleteMessage(url: URL, req: Request) {
  const msgId = parseInt(url.pathname.split("/")[3]);
  const { user_id } = await req.json();
  
  const msg = MessageModel.findById(msgId);
  
  if (!msg || msg.user_id !== user_id) {
    return errorResponse("Unauthorized", 403);
  }
  
  MessageModel.delete(msgId);
  return successResponse({ success: true });
}

export async function reactToMessage(url: URL, req: Request) {
  const msgId = parseInt(url.pathname.split("/")[3]);
  const { user_id, emoji } = await req.json();
  
  const existing = MessageModel.findReaction(msgId, user_id, emoji);
  
  if (existing) {
    MessageModel.removeReaction(existing.id);
    return successResponse({ action: "removed" });
  } else {
    MessageModel.addReaction(msgId, user_id, emoji);
    return successResponse({ action: "added" });
  }
}
