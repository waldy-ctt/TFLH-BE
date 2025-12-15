import { UserModel } from "../models/user.model";
import { successResponse } from "../utils/response";

export async function getAllUsers() {
  const users = UserModel.getAll();
  return successResponse(users);
}

export async function searchUsers(url: URL) {
  const query = url.searchParams.get("q") || "";
  const users = UserModel.search(query);
  return successResponse(users);
}
