import { ConversationModel } from "../models/conversation.model";
import { UserModel } from "../models/user.model";
import { MessageModel } from "../models/message.model";
import { VoteModel } from "../models/vote.model";
import { successResponse, errorResponse } from "../utils/response";
import { broadcastToConversation } from "../index";

export async function createConversation(req: Request) {
  const { name, created_by, member_ids } = await req.json();
  
  const conv = ConversationModel.create(name, created_by);
  const creator = UserModel.findById(created_by);
  
  ConversationModel.addMember(conv.id, created_by);
  
  if (member_ids && Array.isArray(member_ids)) {
    for (const userId of member_ids) {
      if (userId !== created_by) {
        try {
          ConversationModel.addMember(conv.id, userId);
        } catch (e) {}
      }
    }
  }
  
  MessageModel.createSystem(conv.id, `🎉 ${creator?.username} created this conversation`);
  
  // Broadcast to all members
  broadcastToConversation(conv.id, {
    type: "conversation_created",
    conversation: conv
  });
  
  return successResponse(conv);
}

export async function getConversations(url: URL) {
  const userId = parseInt(url.searchParams.get("user_id") || "0");
  const conversations = ConversationModel.getByUserId(userId);
  return successResponse(conversations);
}

export async function updateConversationName(url: URL, req: Request) {
  const convId = parseInt(url.pathname.split("/")[3]);
  const { name, user_id } = await req.json();
  
  if (!ConversationModel.isMember(convId, user_id)) {
    return errorResponse("Not a member", 403);
  }
  
  const user = UserModel.findById(user_id);
  const oldConv = ConversationModel.findById(convId);
  
  ConversationModel.updateName(convId, name);
  
  MessageModel.createSystem(
    convId,
    `✏️ ${user?.username} changed conversation name from "${oldConv?.name}" to "${name}"`
  );
  
  // Broadcast name change to all members
  broadcastToConversation(convId, {
    type: "conversation_updated",
    conversationId: convId,
    name
  }, user_id);
  
  return successResponse({ success: true });
}

export async function getMembers(url: URL) {
  const convId = parseInt(url.pathname.split("/")[3]);
  const members = ConversationModel.getMembers(convId);
  return successResponse(members);
}

export async function addMember(url: URL, req: Request) {
  const convId = parseInt(url.pathname.split("/")[3]);
  const { user_id, added_by_id } = await req.json();
  
  try {
    ConversationModel.addMember(convId, user_id);
    
    const newMember = UserModel.findById(user_id);
    
    if (added_by_id) {
      const adder = UserModel.findById(added_by_id);
      MessageModel.createSystem(
        convId,
        `➕ ${adder?.username} added ${newMember?.username} to the conversation`
      );
    } else {
      MessageModel.createSystem(
        convId,
        `➕ ${newMember?.username} joined the conversation`
      );
    }
    
    // Broadcast member added to existing members
    broadcastToConversation(convId, {
      type: "member_added",
      conversationId: convId,
      userId: user_id,
      username: newMember?.username
    }, user_id);
    
    // Send special event to the newly added member with full conversation info
    const { broadcastToUser } = require("../index");
    const conversation = ConversationModel.findById(convId);
    broadcastToUser(user_id, {
      type: "joined_conversation",
      conversation: conversation
    });
    
    return successResponse({ success: true });
  } catch (e) {
    return errorResponse("User already in conversation", 409);
  }
}

export async function leaveConversation(url: URL, req: Request) {
  const convId = parseInt(url.pathname.split("/")[3]);
  const { user_id } = await req.json();
  
  const user = UserModel.findById(user_id);
  
  ConversationModel.removeMember(convId, user_id);
  MessageModel.createSystem(convId, `👋 ${user?.username} left the conversation`);
  
  // Broadcast member left
  broadcastToConversation(convId, {
    type: "member_left",
    conversationId: convId,
    userId: user_id
  }, user_id);
  
  return successResponse({ success: true });
}

export async function voteKick(url: URL, req: Request) {
  const convId = parseInt(url.pathname.split("/")[3]);
  const { target_user_id, voter_user_id, vote } = await req.json();
  
  VoteModel.upsertKickVote(convId, target_user_id, voter_user_id, vote);
  
  const totalMembers = ConversationModel.getMemberCount(convId);
  const yesVotes = VoteModel.getKickYesVotes(convId, target_user_id);
  
  if (yesVotes >= totalMembers * 0.7) {
    const target = UserModel.findById(target_user_id);
    
    ConversationModel.removeMember(convId, target_user_id);
    VoteModel.deleteKickVotes(convId, target_user_id);
    
    MessageModel.createSystem(convId, `⚠️ ${target?.username} was removed from the conversation`);
    
    // Broadcast member kicked
    broadcastToConversation(convId, {
      type: "member_kicked",
      conversationId: convId,
      userId: target_user_id
    });
    
    return successResponse({ success: true, kicked: true });
  }
  
  return successResponse({ success: true, kicked: false });
}

export async function getKickVotes(url: URL) {
  const parts = url.pathname.split("/");
  const convId = parseInt(parts[3]);
  const targetUserId = parseInt(parts[5]);
  
  const votes = VoteModel.getKickVotes(convId, targetUserId);
  const totalMembers = ConversationModel.getMemberCount(convId);
  
  return successResponse({ votes, totalMembers });
}

export async function voteDeleteConversation(url: URL, req: Request) {
  const convId = parseInt(url.pathname.split("/")[3]);
  const { voter_user_id, vote } = await req.json();
  
  VoteModel.upsertDeleteVote(convId, voter_user_id, vote);
  
  const totalMembers = ConversationModel.getMemberCount(convId);
  const yesVotes = VoteModel.getDeleteYesVotes(convId);
  
  if (yesVotes === totalMembers) {
    MessageModel.deleteByConversation(convId);
    ConversationModel.removeMember(convId, voter_user_id);
    VoteModel.deleteKickVotesByConversation(convId);
    VoteModel.deleteDeleteVotes(convId);
    ConversationModel.delete(convId);
    
    // Broadcast conversation deleted
    broadcastToConversation(convId, {
      type: "conversation_deleted",
      conversationId: convId
    });
    
    return successResponse({ success: true, deleted: true });
  }
  
  return successResponse({ success: true, deleted: false });
}

export async function getDeleteVotes(url: URL) {
  const convId = parseInt(url.pathname.split("/")[3]);
  
  const votes = VoteModel.getDeleteVotes(convId);
  const totalMembers = ConversationModel.getMemberCount(convId);
  
  return successResponse({ votes, totalMembers });
}
