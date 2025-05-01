import { Hono } from "hono"
import { cors } from "hono/cors"
import { handle } from "hono/vercel"
import { projectRouter } from "@/server/routers/project-router"

const app = new Hono().basePath("/api/v1").use(cors())
app.route("/project", projectRouter)

export const runtime = "nodejs"
export const GET = handle(app)
export const POST = handle(app) 