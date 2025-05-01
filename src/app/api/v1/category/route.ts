import { Hono } from "hono"
import { cors } from "hono/cors"
import { handle } from "hono/vercel"
import { categoryRouter } from "@/server/routers/category-router"

const app = new Hono().basePath("/api/v1").use(cors())
app.route("/category", categoryRouter)

export const runtime = "nodejs"
export const GET = handle(app)
export const POST = handle(app) 