import { UserModel } from "../models/user.model";
import { successResponse, errorResponse } from "../utils/response";

export async function signUp(req: Request) {
  const { username, password } = await req.json();
  
  if (!username || !password) {
    return errorResponse("Username and password required", 400);
  }

  try {
    const user = UserModel.create(username, password);
    return successResponse(user);
  } catch (e) {
    return errorResponse("Username already exists", 409);
  }
}

export async function signIn(req: Request) {
  const { username, password } = await req.json();
  
  const user = UserModel.findByCredentials(username, password);
  
  if (!user) {
    return errorResponse("Invalid credentials", 401);
  }
  
  return successResponse(user);
}
