import { Hono } from "hono"
import { cors } from "hono/cors"
import { handle } from "hono/vercel"
import { authRouter } from "@/server/routers/auth-router"

const app = new Hono().basePath("/api/v1").use(cors())
app.route("/auth", authRouter)

export const runtime = "nodejs"
export const GET = handle(app)
export const POST = handle(app) 