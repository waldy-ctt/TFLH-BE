import { initializeDatabase } from "./config/database";
import { corsHeaders, errorResponse } from "./utils/response";
import { authRoutes } from "./routes/auth.routes";
import { userRoutes } from "./routes/user.routes";
import { conversationRoutes } from "./routes/conversation.routes";
import { messageRoutes } from "./routes/message.routes";

initializeDatabase();

// Store WebSocket connections by user ID
const connections = new Map<number, Set<any>>();

// Broadcast event to all users in a conversation
export function broadcastToConversation(conversationId: number, event: any, excludeUserId?: number) {
  const { ConversationModel } = require("./models/conversation.model");
  const members = ConversationModel.getMembers(conversationId);
  
  members.forEach((member: any) => {
    if (member.id !== excludeUserId) {
      broadcastToUser(member.id, event);
    }
  });
}

// Broadcast event to specific user
export function broadcastToUser(userId: number, event: any) {
  const userConnections = connections.get(userId);
  if (userConnections) {
    userConnections.forEach((ws) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify(event));
      }
    });
  }
}

const server = Bun.serve({
  port: 3000,
  async fetch(req, server) {
    const url = new URL(req.url);

    // Handle WebSocket upgrade
    if (url.pathname === "/ws" && req.headers.get("upgrade") === "websocket") {
      const userId = url.searchParams.get("user_id");
      if (!userId) {
        return new Response("Missing user_id", { status: 400 });
      }

      const upgraded = server.upgrade(req, {
        data: { userId: parseInt(userId) }
      });

      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 500 });
      }

      return undefined;
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Try each route handler
      const authResponse = await authRoutes(url, req);
      if (authResponse) return authResponse;

      const userResponse = await userRoutes(url, req);
      if (userResponse) return userResponse;

      const conversationResponse = await conversationRoutes(url, req);
      if (conversationResponse) return conversationResponse;

      const messageResponse = await messageRoutes(url, req);
      if (messageResponse) return messageResponse;

      return errorResponse("Not Found", 404);
    } catch (error) {
      console.error("Server error:", error);
      return errorResponse("Internal server error", 500);
    }
  },
  websocket: {
    open(ws) {
      const userId = ws.data.userId;
      console.log(`WebSocket connected: User ${userId}`);

      if (!connections.has(userId)) {
        connections.set(userId, new Set());
      }
      connections.get(userId)!.add(ws);

      // Send connection confirmation
      ws.send(JSON.stringify({
        type: "connected",
        userId,
        timestamp: new Date().toISOString()
      }));
    },
    message(ws, message) {
      // Handle ping/pong for keep-alive
      const data = JSON.parse(message as string);
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    },
    close(ws) {
      const userId = ws.data.userId;
      console.log(`WebSocket disconnected: User ${userId}`);

      const userConnections = connections.get(userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          connections.delete(userId);
        }
      }
    },
  },
});

console.log(`🚀 TFLH Backend running on http://localhost:${server.port}`);
console.log(`🔌 WebSocket available at ws://localhost:${server.port}/ws`);
