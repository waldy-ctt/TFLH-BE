import { getAllUsers, searchUsers } from "../controllers/user.controller";

export async function userRoutes(url: URL, req: Request) {
  if (url.pathname === "/api/users" && req.method === "GET") {
    return await getAllUsers();
  }
  
  if (url.pathname === "/api/users/search" && req.method === "GET") {
    return await searchUsers(url);
  }
  
  return null;
}
