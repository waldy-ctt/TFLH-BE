import { initializeDatabase } from "./config/database";
import { corsHeaders, errorResponse } from "./utils/response";
import { authRoutes } from "./routes/auth.routes";
import { userRoutes } from "./routes/user.routes";
import { conversationRoutes } from "./routes/conversation.routes";
import { messageRoutes } from "./routes/message.routes";

initializeDatabase();

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

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
});

console.log(`🚀 TFLH Backend running on http://localhost:${server.port}`);
