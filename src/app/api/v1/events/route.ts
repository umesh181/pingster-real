import { FREE_QUOTA, PRO_QUOTA } from "@/config"
import { db } from "@/db"
import { DiscordClient } from "@/lib/discord-client"
import { CATEGORY_NAME_VALIDATOR } from "@/lib/validators/category-validator"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const REQUEST_VALIDATOR = z
  .object({
    category: CATEGORY_NAME_VALIDATOR,
    fields: z.record(z.string().or(z.number()).or(z.boolean())).optional(),
    description: z.string().optional(),
  })
  .strict()

export const POST = async (req: NextRequest) => {
  try {
    // Parse request JSON upfront to catch JSON parsing errors early
    let requestData: unknown
    try {
      requestData = await req.json()
    } catch (err) {
      console.error("Invalid JSON request body:", err)
      return NextResponse.json(
        {
          message: "Invalid JSON request body",
        },
        { status: 400 }
      )
    }

    // Validate the request data
    let validationResult
    try {
      validationResult = REQUEST_VALIDATOR.parse(requestData)
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error("Validation error:", err.message)
        return NextResponse.json({ message: err.message }, { status: 422 })
      }
      throw err
    }

    // Auth check
    const authHeader = req.headers.get("Authorization")

    if (!authHeader) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          message: "Invalid auth header format. Expected: 'Bearer [API_KEY]'",
        },
        { status: 401 }
      )
    }

    const apiKey = authHeader.split(" ")[1]

    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json({ message: "Invalid API key" }, { status: 401 })
    }

    // Find user
    const user = await db.user.findUnique({
      where: { apiKey },
      include: { EventCategories: true },
    })

    if (!user) {
      console.error(`User not found for API key: ${apiKey}`)
      return NextResponse.json({ message: "Invalid API key" }, { status: 401 })
    }

    if (!user.discordId) {
      return NextResponse.json(
        {
          message: "Please enter your discord ID in your account settings",
        },
        { status: 403 }
      )
    }

    // Check category
    const category = user.EventCategories.find(
      (cat) => cat.name === validationResult.category
    )

    if (!category) {
      console.error(`Category not found: ${validationResult.category} for user ${user.id}`)
      return NextResponse.json(
        {
          message: `You dont have a category named "${validationResult.category}"`,
        },
        { status: 404 }
      )
    }

    // Check quota
    const currentData = new Date()
    const currentMonth = currentData.getMonth() + 1
    const currentYear = currentData.getFullYear()

    const quota = await db.quota.findUnique({
      where: {
        userId_year_month: {
          userId: user.id,
          month: currentMonth,
          year: currentYear,
        }
      },
    })

    const quotaLimit =
      user.plan === "FREE"
        ? FREE_QUOTA.maxEventsPerMonth
        : PRO_QUOTA.maxEventsPerMonth

    if (quota && quota.count >= quotaLimit) {
      return NextResponse.json(
        {
          message:
            "Monthly quota reached. Please upgrade your plan for more events",
        },
        { status: 429 }
      )
    }

    // Create event record first
    const eventData = {
      title: `${category.emoji || "🔔"} ${
        category.name.charAt(0).toUpperCase() + category.name.slice(1)
      }`,
      description:
        validationResult.description ||
        `A new ${category.name} event has occurred!`,
      color: category.color,
      timestamp: new Date().toISOString(),
      fields: Object.entries(validationResult.fields || {}).map(
        ([key, value]) => {
          return {
            name: key,
            value: String(value),
            inline: true,
          }
        }
      ),
    }

    const event = await db.event.create({
      data: {
        name: category.name,
        formattedMessage: `${eventData.title}\n\n${eventData.description}`,
        userId: user.id,
        fields: validationResult.fields || {},
        eventCategoryId: category.id,
      },
    })

    // Try to deliver to Discord
    try {
      if (!process.env.DISCORD_BOT_TOKEN) {
        console.error("Discord bot token is missing")
        throw new Error("Discord bot token is not configured")
      }
      
      const discord = new DiscordClient(process.env.DISCORD_BOT_TOKEN)
      
      // Create DM channel
      const dmChannel = await discord.createDM(user.discordId).catch(err => {
        console.error("Error creating Discord DM channel:", err)
        throw new Error(`Failed to create Discord DM: ${err.message || 'Unknown error'}`)
      })
      
      if (!dmChannel || !dmChannel.id) {
        console.error("Invalid DM channel response:", dmChannel)
        throw new Error("Failed to create Discord DM: Invalid channel")
      }

      // Send message
      await discord.sendEmbed(dmChannel.id, eventData).catch(err => {
        console.error("Error sending Discord embed:", err)
        throw new Error(`Failed to send Discord message: ${err.message || 'Unknown error'}`)
      })

      // Update delivery status
      await db.event.update({
        where: { id: event.id },
        data: { deliveryStatus: "DELIVERED" },
      })

      // Update quota
      await db.quota.upsert({
        where: {
          userId_year_month: {
            userId: user.id,
            month: currentMonth,
            year: currentYear,
          }
        },
        update: { count: { increment: 1 } },
        create: {
          userId: user.id,
          month: currentMonth,
          year: currentYear,
          count: 1,
        },
      })
      
      return NextResponse.json({
        message: "Event processed successfully",
        eventId: event.id,
      })
    } catch (err) {
      console.error("Error during Discord delivery:", err)
      
      // Update event status to failed
      await db.event.update({
        where: { id: event.id },
        data: { deliveryStatus: "FAILED" },
      })

      return NextResponse.json(
        {
          message: "Error processing event: " + (err instanceof Error ? err.message : "Unknown error"),
          eventId: event.id,
        },
        { status: 500 }
      )
    }
  } catch (err) {
    console.error("Unhandled error in events endpoint:", err)

    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.message }, { status: 422 })
    }

    return NextResponse.json(
      { message: "Internal server error" + (err instanceof Error ? `: ${err.message}` : "") },
      { status: 500 }
    )
  }
}
