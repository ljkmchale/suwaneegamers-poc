import { NextResponse } from "next/server";
import { fetchUpcomingCalendarEvents } from "@/lib/calendar";

export async function GET() {
  try {
    const events = await fetchUpcomingCalendarEvents(12);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("[Calendar Events]", err);
    return NextResponse.json(
      { error: "Failed to read Google Calendar events" },
      { status: 502 }
    );
  }
}
