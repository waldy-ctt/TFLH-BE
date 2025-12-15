import {
  getMessages,
  sendMessage,
  deleteMessage,
  reactToMessage
} from "../controllers/message.controller";

export async function messageRoutes(url: URL, req: Request) {
  // Get messages
  if (url.pathname.match(/^\/api\/conversations\/\d+\/messages$/) && req.method === "GET") {
    return await getMessages(url);
  }
  
  // Send message
  if (url.pathname.match(/^\/api\/conversations\/\d+\/messages$/) && req.method === "POST") {
    return await sendMessage(url, req);
  }
  
  // Delete message
  if (url.pathname.match(/^\/api\/messages\/\d+$/) && req.method === "DELETE") {
    return await deleteMessage(url, req);
  }
  
  // React to message
  if (url.pathname.match(/^\/api\/messages\/\d+\/react$/) && req.method === "POST") {
    return await reactToMessage(url, req);
  }
  
  return null;
}
