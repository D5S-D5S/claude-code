import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured. Add ANTHROPIC_API_KEY to .env" },
        { status: 503 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = (imageFile.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif") || "image/jpeg";

    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: `You are an expert balloon decorator. Analyze this image and estimate the total length of balloon garland/arch/decoration that would be needed to fill this space or match what is shown.

Please provide your estimate in JSON format with these exact fields:
{
  "length_feet": <number>,
  "length_meters": <number>,
  "confidence": <number between 0 and 1>,
  "description": "<brief description of what you see and how you estimated>",
  "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]
}

Rules:
- length_feet and length_meters should be realistic estimates for a balloon business (typically 5-200 feet)
- confidence should reflect how clear the image is and how certain you are
- description should explain what you see (room size, event type, existing decorations)
- suggestions should give practical balloon decoration advice

Respond ONLY with the JSON, no other text.`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Parse the JSON response
    const jsonText = content.text.trim();
    const result = JSON.parse(jsonText);

    // Validate the response structure
    if (
      typeof result.length_feet !== "number" ||
      typeof result.length_meters !== "number" ||
      typeof result.confidence !== "number"
    ) {
      throw new Error("Invalid response structure from AI");
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("AI estimate error:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
