import {
  createConversation,
  getConversations,
  updateConversationName,
  getMembers,
  addMember,
  leaveConversation,
  voteKick,
  getKickVotes,
  voteDeleteConversation,
  getDeleteVotes
} from "../controllers/conversation.controller";

export async function conversationRoutes(url: URL, req: Request) {
  // Create conversation
  if (url.pathname === "/api/conversations" && req.method === "POST") {
    return await createConversation(req);
  }
  
  // Get conversations
  if (url.pathname === "/api/conversations" && req.method === "GET") {
    return await getConversations(url);
  }
  
  // Update conversation name
  if (url.pathname.match(/^\/api\/conversations\/\d+$/) && req.method === "PUT") {
    return await updateConversationName(url, req);
  }
  
  // Get members
  if (url.pathname.match(/^\/api\/conversations\/\d+\/members$/) && req.method === "GET") {
    return await getMembers(url);
  }
  
  // Add member
  if (url.pathname.match(/^\/api\/conversations\/\d+\/members$/) && req.method === "POST") {
    return await addMember(url, req);
  }
  
  // Leave conversation
  if (url.pathname.match(/^\/api\/conversations\/\d+\/leave$/) && req.method === "POST") {
    return await leaveConversation(url, req);
  }
  
  // Vote kick
  if (url.pathname.match(/^\/api\/conversations\/\d+\/kick$/) && req.method === "POST") {
    return await voteKick(url, req);
  }
  
  // Get kick votes
  if (url.pathname.match(/^\/api\/conversations\/\d+\/kick\/\d+$/) && req.method === "GET") {
    return await getKickVotes(url);
  }
  
  // Vote delete conversation
  if (url.pathname.match(/^\/api\/conversations\/\d+\/delete-vote$/) && req.method === "POST") {
    return await voteDeleteConversation(url, req);
  }
  
  // Get delete votes
  if (url.pathname.match(/^\/api\/conversations\/\d+\/delete-vote$/) && req.method === "GET") {
    return await getDeleteVotes(url);
  }
  
  return null;
}
