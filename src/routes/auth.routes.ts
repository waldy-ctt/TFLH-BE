import { signUp, signIn } from "../controllers/auth.controller";

export function authRoutes(url: URL, req: Request) {
  if (url.pathname === "/api/signup" && req.method === "POST") {
    return signUp(req);
  }
  
  if (url.pathname === "/api/signin" && req.method === "POST") {
    return signIn(req);
  }
  
  return null;
}
